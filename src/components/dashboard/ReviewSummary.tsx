import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, Mail, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Gap {
  section: string;
  customerText: string;
  gapType: 'negative_match';
  severity: 'KRITISCH' | 'MITTEL' | 'GERING';
  aiRecommendation: string;
  ownCodexCoverage: string;
  reasoning: string;
  risksIfAccepted: string;
  matchedNegativePoint?: {
    title: string;
    description: string;
  };
  matchConfidence?: 'HOCH' | 'MITTEL' | 'NIEDRIG';
}

interface ReviewSummaryProps {
  gaps: Gap[];
  decisions: Record<number, 'accept' | 'reject'>;
  analysisId: string | null;
  comparisonDocumentId: string | null;
  onRestart: () => void;
}

export const ReviewSummary = ({ gaps, decisions, analysisId, comparisonDocumentId, onRestart }: ReviewSummaryProps) => {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { t } = useTranslation();

  const acceptedCount = Object.values(decisions).filter(d => d === 'accept').length;
  const rejectedCount = Object.values(decisions).filter(d => d === 'reject').length;

  const rejectedGaps = gaps.filter((_, index) => decisions[index] === 'reject');

  const generateEmailTemplate = async () => {
    setIsGenerating(true);
    try {
      const rejectedData = rejectedGaps.map(gap => ({
        section: gap.section,
        customerText: gap.customerText,
        reasoning: gap.reasoning,
        severity: gap.severity
      }));

      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: { rejectedGaps: rejectedData }
      });

      if (error) throw error;

      setEmailTemplate(data.emailTemplate);
      setShowEmailDialog(true);
      toast.success(t('toast.emailGenerated'));
    } catch (error) {
      console.error('Error generating email:', error);
      toast.error(t('toast.emailGenerateError'));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailTemplate);
    toast.success(t('toast.copiedToClipboard'));
  };

  const saveEvaluation = async () => {
    if (!analysisId || !comparisonDocumentId) {
      toast.error(t('toast.missingAnalysisData'));
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('toast.notAuthenticated'));
        return;
      }

      const { data: compDoc } = await supabase
        .from("comparison_documents")
        .select("content, title")
        .eq("id", comparisonDocumentId)
        .single();

      let customerName = "Unknown Company";
      let title = "Supplier Code";

      if (compDoc) {
        const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-company-name', {
          body: { documentContent: compDoc.content }
        });

        if (!extractError && extractData?.companyName) {
          customerName = extractData.companyName;
        }

        title = `${customerName} Supplier Code`;
      }

      const criticalGaps = rejectedGaps.filter(g => g.severity === 'KRITISCH').length;
      const mediumGaps = rejectedGaps.filter(g => g.severity === 'MITTEL').length;
      const lowGaps = rejectedGaps.filter(g => g.severity === 'GERING').length;

      const { error } = await supabase
        .from("completed_evaluations")
        .insert({
          user_id: user.id,
          comparison_document_id: comparisonDocumentId,
          customer_name: customerName,
          title: title,
          gaps: gaps as any,
          decisions: decisions as any,
          email_template: emailTemplate || null,
          overall_compliance: 0,
          critical_gaps: criticalGaps,
          medium_gaps: mediumGaps,
          low_gaps: lowGaps,
        });

      if (error) throw error;

      setIsSaved(true);
      toast.success(t('toast.evaluationSaved'));
    } catch (error) {
      console.error('Error saving evaluation:', error);
      toast.error(t('toast.evaluationSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const criticalRejected = rejectedGaps.filter(g => g.severity === 'KRITISCH').length;
  const mediumRejected = rejectedGaps.filter(g => g.severity === 'MITTEL').length;
  const lowRejected = rejectedGaps.filter(g => g.severity === 'GERING').length;

  const getSeverityBadge = (severity: string) => {
    const variants = {
      'KRITISCH': 'destructive' as const,
      'MITTEL': 'default' as const,
      'GERING': 'secondary' as const,
    };
    return variants[severity as keyof typeof variants] || 'default' as const;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6" />
          {t('summary.title')}
        </CardTitle>
        <CardDescription>{t('summary.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">{acceptedCount}</div>
            <div className="text-sm text-muted-foreground">{t('summary.accepted')}</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-destructive">{rejectedCount}</div>
            <div className="text-sm text-muted-foreground">{t('summary.rejected')}</div>
          </div>
        </div>

        {rejectedCount > 0 && (
          <>
            <Separator />
            
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <div className="text-xl font-bold text-destructive">{criticalRejected}</div>
                <div className="text-xs text-muted-foreground">{t('summary.criticalSeverity')}</div>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <div className="text-xl font-bold text-primary">{mediumRejected}</div>
                <div className="text-xs text-muted-foreground">{t('summary.mediumSeverity')}</div>
              </div>
              <div className="text-center p-3 bg-secondary/10 rounded-lg">
                <div className="text-xl font-bold text-secondary-foreground">{lowRejected}</div>
                <div className="text-xs text-muted-foreground">{t('summary.lowSeverity')}</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">{t('summary.rejectedPoints')}</h3>
              
              <div className="space-y-4">
                {rejectedGaps.map((gap, index) => (
                  <div key={index} className="border-l-4 border-destructive pl-4 py-2">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-sm">{gap.section}</h4>
                        <Badge variant={getSeverityBadge(gap.severity)} className="mt-1">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t(`analysis.severity.${gap.severity}`)}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2 mt-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('summary.customerRequirement')}:</p>
                        <p className="text-sm">{gap.customerText}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('summary.rejectionReason')}:</p>
                        <p className="text-sm">{gap.reasoning}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button 
                  onClick={generateEmailTemplate} 
                  variant="default" 
                  className="flex-1"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('summary.generating')}
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      {t('summary.generateEmail')}
                    </>
                  )}
                </Button>
                <Button onClick={onRestart} variant="outline" className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('summary.restart')}
                </Button>
              </div>

              <Button 
                onClick={saveEvaluation} 
                variant="secondary" 
                className="w-full"
                disabled={isSaving || isSaved}
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('summary.saving')}
                  </>
                ) : isSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('summary.saved')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('summary.saveEvaluation')}
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {rejectedCount === 0 && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('summary.allAccepted')}</h3>
            <p className="text-muted-foreground mb-6">{t('summary.allAcceptedMessage')}</p>
            <Button onClick={onRestart} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('summary.newAnalysis')}
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('summary.emailTemplateTitle')}</DialogTitle>
            <DialogDescription>{t('summary.emailTemplateDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={copyToClipboard} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                {t('summary.copyToClipboard')}
              </Button>
              <Button onClick={() => setShowEmailDialog(false)} variant="outline" className="flex-1">
                {t('common.close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};