import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface ComparisonUploadProps {
  userId: string;
  baselineId: string | null;
  onAnalysisComplete: (analysisId: string, comparisonDocumentId: string) => void;
}

const ComparisonUpload = ({ userId, baselineId, onAnalysisComplete }: ComparisonUploadProps) => {
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
        text = await extract(file);
      } else {
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
    try {
      // Step 1: Detect document type
      const { data: typeData, error: typeError } = await supabase.functions.invoke('detect-document-type', {
        body: { content }
      });

      if (typeError) throw typeError;

      const documentType = typeData.documentType as 'supplier_code' | 'nda';
      
      console.log('Detected document type:', documentType);

      // Step 2: Get matching baseline document
      const { data: baseline, error: baselineError } = await supabase
        .from("baseline_documents")
        .select("*")
        .eq("user_id", userId)
        .eq("document_type", documentType)
        .maybeSingle();

      if (baselineError) throw baselineError;

      if (!baseline) {
        toast({
          title: "Fehler",
          description: `Kein ${documentType === 'nda' ? 'NDA-Template' : 'Lieferantenkodex'} als Datengrundlage gefunden. Bitte hinterlegen Sie zuerst ein Basisdokument.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Step 3: Get accepted requirements for this document type
      const { data: acceptedRequirements } = await supabase
        .from("accepted_requirements")
        .select("requirement_text, section, category")
        .eq("user_id", userId)
        .eq("document_type", documentType);

      // Step 4: Save comparison document
      const { data: comparisonDoc, error: comparisonError } = await supabase
        .from("comparison_documents")
        .insert({
          user_id: userId,
          baseline_document_id: baseline.id,
          title,
          content,
          file_name: fileName || "manual-entry.txt",
        })
        .select()
        .single();

      if (comparisonError) throw comparisonError;

      // Step 5: Call edge function for AI analysis
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

      // Step 6: Save analysis results
      const { data: analysis, error: analysisError } = await supabase
        .from("gap_analyses")
        .insert({
          user_id: userId,
          baseline_document_id: baseline.id,
          comparison_document_id: comparisonDoc.id,
          overall_compliance_percentage: 0,
          total_gaps: analysisResult.totalGaps,
          critical_gaps: analysisResult.criticalGaps,
          medium_gaps: analysisResult.mediumGaps,
          low_gaps: analysisResult.lowGaps,
          gaps: analysisResult.gaps,
          document_type: documentType,
        })
        .select()
        .single();

      if (analysisError) throw analysisError;

      toast({
        title: "Analyse abgeschlossen",
        description: `Ihr ${documentType === 'nda' ? 'NDA' : 'Dokument'} wurde erfolgreich analysiert`,
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

  if (loading) {
    return <LoadingSpinner text="Dokument wird analysiert..." />;
  }

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Dokument hochladen</h2>
          <p className="text-muted-foreground">
            Laden Sie ein Kundendokument hoch. Die KI erkennt automatisch, ob es sich um einen Lieferantenkodex oder ein NDA handelt und analysiert es entsprechend.
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
        </div>
      </div>
    </Card>
  );
};

export default ComparisonUpload;
