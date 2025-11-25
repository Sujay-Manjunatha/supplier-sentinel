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

      setContent(text);
      setFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }

      toast({
        title: "Datei hochgeladen",
        description: isPDF ? "Text wurde erfolgreich aus PDF extrahiert." : "Textdatei erfolgreich geladen.",
      });
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload fehlgeschlagen",
        description: "Die Datei konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!title || !content || !baselineId) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie sowohl Titel als auch Inhalt an",
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
        title: "Analyse abgeschlossen",
        description: "Ihr Dokument wurde erfolgreich analysiert",
      });

      onAnalysisComplete(analysis.id, comparisonDoc.id);

      // Reset form
      setTitle("");
      setContent("");
      setFileName("");
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
            Laden Sie den Lieferantenkodex Ihres Kunden hoch. Die App prüft, welche Anforderungen der Kunde stellt, die Sie noch nicht in Ihrem Kodex haben.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comparison-file">Dokument hochladen (Optional)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="comparison-file"
                type="file"
                accept=".txt,.pdf"
                onChange={handleFileUpload}
                disabled={loading}
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
            <Label htmlFor="comparison-title">Dokumenttitel</Label>
            <Input
              id="comparison-title"
              placeholder="z.B. Kunde ABC Lieferantenkodex"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comparison-content">Inhalt</Label>
            <Textarea
              id="comparison-content"
              placeholder="Fügen Sie den Kundenkodex hier ein..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          <Button onClick={handleAnalyze} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird analysiert...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Dokument analysieren
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ComparisonUpload;
