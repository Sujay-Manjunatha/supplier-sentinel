import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";

interface ComparisonUploadProps {
  userId: string;
  baselineId: string | null;
  onAnalysisComplete: (analysisId: string, comparisonDocumentId: string) => void;
}

const ComparisonUpload = ({ userId, baselineId, onAnalysisComplete }: ComparisonUploadProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isTXT = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

    if (!isPDF && !isTXT) {
      toast({
        title: "Nicht unterstützter Dateityp",
        description: "Bitte laden Sie eine PDF- oder TXT-Datei hoch.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let text: string;

      if (isPDF) {
        // Extract text from PDF
        text = await extract(file);
      } else {
        // Read text file
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (!text || text.trim().length === 0) {
        toast({
          title: "Leeres Dokument",
          description: "Die Datei scheint leer zu sein oder enthält keinen extrahierbaren Text.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const generatedTitle = file.name.replace(/\.[^.]+$/, "");

      toast({
        title: "Datei hochgeladen",
        description: "Analyse wird gestartet...",
      });

      // Auto-start analysis immediately
      await startAnalysis(text, generatedTitle, file.name);
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload fehlgeschlagen",
        description: "Die Datei konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const startAnalysis = async (content: string, title: string, fileName: string) => {

    if (!baselineId) {
      toast({
        title: "Fehler",
        description: "Kein Kodex als Datengrundlage gefunden",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      // Get baseline document
      const { data: baseline, error: baselineError } = await supabase
        .from("baseline_documents")
        .select("content")
        .eq("id", baselineId)
        .single();

      if (baselineError) throw baselineError;

      // Get accepted requirements for this user
      const { data: acceptedRequirements } = await supabase
        .from("accepted_requirements")
        .select("requirement_text, section, category")
        .eq("user_id", userId);

      // Save comparison document
      const { data: comparisonDoc, error: comparisonError } = await supabase
        .from("comparison_documents")
        .insert({
          user_id: userId,
          baseline_document_id: baselineId,
          title,
          content,
          file_name: fileName || "manual-entry.txt",
        })
        .select()
        .single();

      if (comparisonError) throw comparisonError;

      // Call edge function for AI analysis
      const { data: analysisResult, error: functionError } = await supabase.functions.invoke(
        "analyze-documents",
        {
          body: {
            baselineContent: baseline.content,
            comparisonContent: content,
            acceptedRequirements: acceptedRequirements || [],
          },
        }
      );

      if (functionError) throw functionError;

      // Save analysis results
      const { data: analysis, error: analysisError } = await supabase
        .from("gap_analyses")
        .insert({
          user_id: userId,
          baseline_document_id: baselineId,
          comparison_document_id: comparisonDoc.id,
          overall_compliance_percentage: analysisResult.overallCompliance,
          total_gaps: analysisResult.totalGaps,
          critical_gaps: analysisResult.criticalGaps,
          medium_gaps: analysisResult.mediumGaps,
          low_gaps: analysisResult.lowGaps,
          gaps: analysisResult.gaps,
        })
        .select()
        .single();

      if (analysisError) throw analysisError;

      toast({
        title: "Analyse abgeschlossen",
        description: "Ihr Dokument wurde erfolgreich analysiert",
      });

      onAnalysisComplete(analysis.id, comparisonDoc.id);
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Fehler",
        description: error.message || "Dokument konnte nicht analysiert werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Kundenkodex hochladen</h2>
          <p className="text-muted-foreground">
            Laden Sie den Lieferantenkodex Ihres Kunden hoch. Die Analyse startet automatisch nach dem Upload.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comparison-file">Dokument hochladen (PDF oder TXT)</Label>
            <Input
              id="comparison-file"
              type="file"
              accept=".txt,.pdf"
              onChange={handleFileUpload}
              disabled={loading}
              className="w-full"
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-3 p-8 bg-muted/50 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold">Dokument wird analysiert...</p>
                <p className="text-sm text-muted-foreground">Dies kann einige Sekunden dauern</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ComparisonUpload;
