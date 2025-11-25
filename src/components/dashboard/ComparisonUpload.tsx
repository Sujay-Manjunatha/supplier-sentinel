import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ComparisonUploadProps {
  userId: string;
  baselineId: string | null;
  onAnalysisComplete: (analysisId: string) => void;
}

const ComparisonUpload = ({ userId, baselineId, onAnalysisComplete }: ComparisonUploadProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setContent(text);
        setFileName(file.name);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!title || !content || !baselineId) {
      toast({
        title: "Error",
        description: "Please provide both title and content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get baseline document
      const { data: baseline, error: baselineError } = await supabase
        .from("baseline_documents")
        .select("content")
        .eq("id", baselineId)
        .single();

      if (baselineError) throw baselineError;

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
        title: "Analysis complete",
        description: "Your document has been analyzed successfully",
      });

      onAnalysisComplete(analysis.id);

      // Reset form
      setTitle("");
      setContent("");
      setFileName("");
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze document",
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
          <h2 className="text-2xl font-bold text-foreground mb-2">Upload Customer Supplier Code</h2>
          <p className="text-muted-foreground">
            Upload the customer's supplier code to compare against your baseline.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comparison-file">Upload Document (Optional)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="comparison-file"
                type="file"
                accept=".txt,.doc,.docx,.pdf"
                onChange={handleFileUpload}
                className="flex-1"
              />
              {fileName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{fileName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comparison-title">Document Title</Label>
            <Input
              id="comparison-title"
              placeholder="e.g., Customer ABC Supplier Code"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comparison-content">Content</Label>
            <Textarea
              id="comparison-content"
              placeholder="Paste or type the customer's supplier code content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          <Button onClick={handleAnalyze} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Analyze Document
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ComparisonUpload;
