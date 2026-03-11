/**
 * Reprocessing utility — re-runs AI analysis on every existing gap_analysis
 * for a given user whenever the foundation documents (CoC / auxiliary) change.
 *
 * Flow per gap_analysis row:
 *  1. Fetch the linked comparison_document's content + document_type
 *  2. Fetch negative_list_items for that document_type
 *  3. Call analyze-documents edge function with the UPDATED foundation docs
 *  4. Overwrite the gap_analysis row with new results
 *  5. Delete any completed_evaluation tied to the same comparison_document
 *     (decisions are no longer valid because the gaps changed)
 */

import { supabase } from "@/integrations/supabase/client";
import { getFoundationStore } from "@/lib/foundationStore";
import { analyzeDocuments } from "@/lib/gemini";

export interface ReprocessProgress {
  total: number;
  completed: number;
  failed: number;
  current: string; // title of the document being processed
}

export type ProgressCallback = (progress: ReprocessProgress) => void;

export async function reprocessExistingAnalyses(
  userId: string,
  onProgress?: ProgressCallback,
): Promise<{ reprocessed: number; failed: number }> {
  // 1. Get all gap_analyses for this user
  const { data: analyses, error: fetchErr } = await supabase
    .from("gap_analyses")
    .select("id, comparison_document_id, document_type")
    .eq("user_id", userId);

  if (fetchErr) {
    console.error("Reprocess: failed to fetch gap_analyses", fetchErr);
    throw fetchErr;
  }

  if (!analyses || analyses.length === 0) {
    return { reprocessed: 0, failed: 0 };
  }

  // 2. Load latest foundation docs from localStorage
  const store = getFoundationStore(userId);
  const cocContent = store.codeOfConduct?.content || null;
  const auxiliaryContents = store.auxiliary
    .filter((d) => d.content)
    .map((d) => d.content);

  let completed = 0;
  let failed = 0;
  const total = analyses.length;

  for (const analysis of analyses) {
    try {
      // 3. Fetch comparison document content
      const { data: compDoc, error: compErr } = await supabase
        .from("comparison_documents")
        .select("content, title")
        .eq("id", analysis.comparison_document_id)
        .single();

      if (compErr || !compDoc) {
        console.warn(`Reprocess: skipping analysis ${analysis.id} — comparison doc not found`);
        failed++;
        continue;
      }

      onProgress?.({
        total,
        completed,
        failed,
        current: compDoc.title,
      });

      // 4. Fetch negative list items for this document type
      const { data: negativeListItems } = await supabase
        .from("negative_list_items")
        .select("*")
        .eq("document_type", analysis.document_type);

      if (!negativeListItems || negativeListItems.length === 0) {
        console.warn(`Reprocess: no negative list for type ${analysis.document_type}, skipping ${analysis.id}`);
        failed++;
        continue;
      }

      // 5. Call Gemini directly for AI analysis with updated foundation docs
      let result;
      try {
        result = await analyzeDocuments({
          documentContent: compDoc.content,
          negativeListItems,
          documentType: analysis.document_type as 'supplier_code' | 'nda',
          ownCodeOfConduct: cocContent,
          auxiliaryDocuments: auxiliaryContents,
        });
      } catch (fnErr) {
        console.error(`Reprocess: Gemini call failed for ${analysis.id}`, fnErr);
        failed++;
        continue;
      }

      // 6. Update gap_analysis row with new results
      const { error: updateErr } = await supabase
        .from("gap_analyses")
        .update({
          total_gaps: result.totalGaps,
          critical_gaps: result.criticalGaps,
          medium_gaps: result.mediumGaps,
          low_gaps: result.lowGaps,
          gaps: result.gaps,
        })
        .eq("id", analysis.id);

      if (updateErr) {
        console.error(`Reprocess: failed to update gap_analysis ${analysis.id}`, updateErr);
        failed++;
        continue;
      }

      // 7. Delete stale completed_evaluation for this comparison document
      //    (old decisions don't match new gaps)
      await supabase
        .from("completed_evaluations")
        .delete()
        .eq("comparison_document_id", analysis.comparison_document_id)
        .eq("user_id", userId);

      completed++;
    } catch (err) {
      console.error(`Reprocess: unexpected error for analysis ${analysis.id}`, err);
      failed++;
    }
  }

  onProgress?.({ total, completed, failed, current: "" });

  return { reprocessed: completed, failed };
}
