import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Lock, FileText, AlertCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useTranslation } from "react-i18next";
import { getFoundationStore } from "@/lib/foundationStore";
import { detectDocumentType, analyzeDocuments, scanForCautions } from "@/lib/gemini";
import { negativeListStore, comparisonDocStore, gapAnalysisStore, LOCAL_USER_ID } from "@/lib/localStore";

interface ComparisonUploadProps {
  userId: string;
  baselineId: string | null;
  onAnalysisComplete: (analysisId: string, comparisonDocumentId: string) => void;
}

const ComparisonUpload = ({ userId, baselineId, onAnalysisComplete }: ComparisonUploadProps) => {
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const foundationStore = getFoundationStore(userId);
  const hasDocuments = !!foundationStore.codeOfConduct || foundationStore.auxiliary.length > 0;
  const hasNegativeList = negativeListStore.count() > 0;
  const canStart = hasDocuments || hasNegativeList;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isTXT = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

    if (!isPDF && !isTXT) {
      toast({
        title: t('toast.fileTypeNotSupported'),
        description: t('toast.fileTypeDesc'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setErrorBanner(null);

    try {
      // Read file as data URL (for PDF viewer) and as text (for AI analysis) in parallel
      const [text, fileDataUrl] = await Promise.all([
        isPDF
          ? extract(file)
          : new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.onerror = reject;
              reader.readAsText(file);
            }),
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
      ]);

      if (!text || text.trim().length === 0) {
        toast({
          title: t('toast.emptyDocument'),
          description: t('toast.emptyDocumentText'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const generatedTitle = file.name.replace(/\.[^.]+$/, "");
      toast({ title: t('toast.fileUploaded'), description: t('toast.analysisStarting') });
      await startAnalysis(text, generatedTitle, file.name, fileDataUrl);
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: t('toast.uploadFailed'),
        description: t('toast.uploadRetry'),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const startAnalysis = async (content: string, title: string, fileName: string, fileDataUrl?: string) => {
    try {
      // Step 1: Detect document type
      const typeData = await detectDocumentType(content);
      const detectedDocType = typeData.documentType as 'supplier_code' | 'nda';

      // Step 2: Get negative list items for this document type
      const negativeListItems = negativeListStore.getAll(detectedDocType);

      if (!negativeListItems || negativeListItems.length === 0) {
        throw new Error(t('toast.negativeListNotFound'));
      }

      // Step 2b: Load foundation documents from localStorage
      const fs = getFoundationStore(LOCAL_USER_ID);
      const cocContent = fs.codeOfConduct?.content || null;
      const auxiliaryContents = fs.auxiliary.filter(d => d.content).map(d => d.content);

      // Step 3: Save comparison document
      const comparisonDoc = comparisonDocStore.insert({
        user_id: LOCAL_USER_ID,
        baseline_document_id: '00000000-0000-0000-0000-000000000000',
        title,
        content,
        file_name: fileName || "manual-entry.txt",
        file_data_url: fileDataUrl,
      });

      // Step 4: Call Gemini for AI analysis (sequential to avoid rate limits)
      const analysisResult = await analyzeDocuments({
        documentContent: content,
        negativeListItems,
        documentType: detectedDocType,
        ownCodeOfConduct: cocContent,
        auxiliaryDocuments: auxiliaryContents,
      });
      const cautionResult = await scanForCautions(content, detectedDocType);

      // Step 5: Save analysis results
      const analysis = gapAnalysisStore.insert({
        user_id: LOCAL_USER_ID,
        baseline_document_id: '00000000-0000-0000-0000-000000000000',
        comparison_document_id: comparisonDoc.id,
        overall_compliance_percentage: 0,
        total_gaps: analysisResult.totalGaps,
        critical_gaps: analysisResult.criticalGaps,
        medium_gaps: analysisResult.mediumGaps,
        low_gaps: analysisResult.lowGaps,
        gaps: analysisResult.gaps,
        caution_items: cautionResult.cautions,
        document_type: detectedDocType,
      });

      toast({
        title: t('toast.analysisComplete'),
        description: detectedDocType === 'nda' ? t('toast.ndaAnalyzed') : t('toast.documentAnalyzed'),
      });

      onAnalysisComplete(analysis.id, comparisonDoc.id);
    } catch (error: any) {
      console.error("Analysis error:", error);
      const msg: string = error.message || t('toast.analysisError');
      const isQuota = msg.toLowerCase().includes('quota');
      if (isQuota) {
        setErrorBanner(msg);
      } else {
        toast({
          title: t('toast.error'),
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text={t('comparison.analyzing')} />;

  if (!canStart) {
    return (
      <Card className="p-5 w-full max-w-3xl mx-auto">
        <div className="space-y-4 text-center py-8">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">{t('comparison.title')}</h2>
          <p className="text-muted-foreground">{t('comparison.gateRequired')}</p>
          <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
            <FileText className="h-4 w-4" />
            {t('comparison.gateHint')}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 w-full max-w-3xl mx-auto">
      {errorBanner && (
        <div className="flex items-start gap-3 p-4 border border-destructive/40 bg-destructive/5 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive mb-0.5">API Quota Exceeded</p>
            <p className="text-sm text-muted-foreground">{errorBanner}</p>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Card className="p-5">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{t('comparison.title')}</h2>
            <p className="text-muted-foreground">{t('comparison.description')}</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comparison-file">{t('comparison.uploadLabel')}</Label>
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
    </div>
  );
};

export default ComparisonUpload;
