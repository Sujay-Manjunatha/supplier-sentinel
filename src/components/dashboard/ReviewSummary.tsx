import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, RotateCcw, Mail, Copy, Loader2, Eye, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { generateEmail, extractCompanyName, type CautionItem } from "@/lib/gemini";
import type { CommentsMap } from "./RejectedPointsCommentReview";
import { completedEvaluationStore, comparisonDocStore, draftEmailStore, LOCAL_USER_ID } from "@/lib/localStore";

interface Gap {
  section: string;
  customerText: string;
  gapType: 'negative_match';
  severity: 'KRITISCH' | 'MITTEL' | 'GERING';
  aiRecommendation: string;
  ownCodexCoverage: string;
  reasoning: string;
  risksIfAccepted: string;
  matchedNegativePoint?: { title: string; description: string; };
  matchConfidence?: 'HOCH' | 'MITTEL' | 'NIEDRIG';
}

interface ReviewSummaryProps {
  gaps: Gap[];
  decisions: Record<number, 'accept' | 'reject'>;
  analysisId: string | null;
  comparisonDocumentId: string | null;
  onRestart: () => void;
  rejectedCautionItems?: CautionItem[];
  allCautionItems?: CautionItem[];
  comments?: CommentsMap;
}

export const ReviewSummary = ({ gaps, decisions, analysisId, comparisonDocumentId, onRestart, rejectedCautionItems = [], allCautionItems = [], comments = {} }: ReviewSummaryProps) => {
  const [emailTemplate, setEmailTemplate] = useState<string>(() => {
    try { return draftEmailStore.load(); } catch { return ''; }
  });
  const [showEmail, setShowEmail] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [showCautions, setShowCautions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { t } = useTranslation();

  const acceptedCount = Object.values(decisions).filter(d => d === 'accept').length;
  const rejectedCount = Object.values(decisions).filter(d => d === 'reject').length;
  const acceptedGaps = gaps.filter((_, index) => decisions[index] === 'accept');
  const rejectedGaps = gaps.filter((_, index) => decisions[index] === 'reject');

  const generateEmailTemplate = async () => {
    setIsGenerating(true);
    try {
      const rejectedData = rejectedGaps.map((gap, index) => ({
        section: gap.section,
        customerText: gap.customerText,
        reasoning: gap.reasoning,
        severity: gap.severity,
        externalComment: comments[`gap-${index}`]?.external || undefined,
      }));
      const cautionData = rejectedCautionItems.map((item, index) => ({
        section: item.section,
        customerText: item.excerpt,
        reasoning: item.reason,
        severity: 'MITTEL' as const,
        externalComment: comments[`caution-${index}`]?.external || undefined,
      }));
      const data = await generateEmail([...rejectedData, ...cautionData]);
      const template = data?.emailTemplate ?? '';
      if (template) {
        setEmailTemplate(template);
        try { draftEmailStore.save(template); } catch { /* localStorage full */ }
        setShowEmail(true);
        toast.success(t('toast.emailGenerated'));
      } else {
        toast.error(t('toast.emailGenerateError'));
      }
    } catch (error) {
      console.error('Error generating email:', error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg.includes('leaked') || msg.includes('PERMISSION_DENIED')
        ? 'API key error — please update your Gemini API key and restart the server.'
        : t('toast.emailGenerateError'));
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
      const compDoc = comparisonDocStore.getById(comparisonDocumentId);

      let customerName = "Unknown Company";
      let title = "Supplier Code";

      if (compDoc) {
        const extractData = await extractCompanyName(compDoc.content);
        if (extractData?.companyName) customerName = extractData.companyName;
        title = `${customerName} Supplier Code`;
      }

      const criticalGaps = rejectedGaps.filter(g => g.severity === 'KRITISCH').length;
      const mediumGaps = rejectedGaps.filter(g => g.severity === 'MITTEL').length;
      const lowGaps = rejectedGaps.filter(g => g.severity === 'GERING').length;

      completedEvaluationStore.insert({
        user_id: LOCAL_USER_ID,
        comparison_document_id: comparisonDocumentId,
        customer_name: customerName,
        title,
        gaps: gaps as any,
        decisions: decisions as any,
        email_template: emailTemplate || null,
        overall_compliance: 0,
        critical_gaps: criticalGaps,
        medium_gaps: mediumGaps,
        low_gaps: lowGaps,
        cautions_accepted: allCautionItems.length - rejectedCautionItems.length,
        cautions_rejected: rejectedCautionItems.length,
      });

      try { draftEmailStore.clear(); } catch { /* ignore */ }
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
        {/* Stats — clickable to expand each section */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => acceptedCount > 0 && setShowAccepted(v => !v)}
            className={`text-center p-4 rounded-lg transition-colors ${acceptedCount > 0 ? 'bg-muted hover:bg-muted/70 cursor-pointer' : 'bg-muted cursor-default'}`}
          >
            <div className="text-2xl font-bold text-primary">{acceptedCount}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              {t('summary.accepted')}
              {acceptedCount > 0 && (showAccepted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </div>
          </button>
          <button
            onClick={() => rejectedCount > 0 && setShowRejected(v => !v)}
            className={`text-center p-4 rounded-lg transition-colors ${rejectedCount > 0 ? 'bg-muted hover:bg-muted/70 cursor-pointer' : 'bg-muted cursor-default'}`}
          >
            <div className="text-2xl font-bold text-destructive">{rejectedCount}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              {t('summary.rejected')}
              {rejectedCount > 0 && (showRejected ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </div>
          </button>
          <button
            onClick={() => rejectedCautionItems.length > 0 && setShowCautions(v => !v)}
            className={`text-center p-4 rounded-lg transition-colors ${rejectedCautionItems.length > 0 ? 'bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer' : 'bg-amber-500/10 cursor-default'}`}
          >
            <div className="text-2xl font-bold text-amber-600">{rejectedCautionItems.length}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              Cautions Rejected
              {rejectedCautionItems.length > 0 && (showCautions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </div>
          </button>
        </div>

        {/* All clear */}
        {rejectedCount === 0 && rejectedCautionItems.length === 0 && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-3" />
            <h3 className="text-lg font-semibold mb-1">{t('summary.allAccepted')}</h3>
            <p className="text-muted-foreground text-sm">{t('summary.allAcceptedMessage')}</p>
          </div>
        )}

        {/* Accepted gaps */}
        {showAccepted && acceptedGaps.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {t('summary.accepted')} ({acceptedGaps.length})
              </h3>
              {acceptedGaps.map((gap, index) => (
                <div key={index} className="border-l-4 border-primary/40 pl-4 py-2">
                  <h4 className="font-semibold text-sm">{gap.section}</h4>
                  <Badge variant={getSeverityBadge(gap.severity)} className="mt-1">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {t(`analysis.severity.${gap.severity}`)}
                  </Badge>
                  <p className="text-sm mt-2">{gap.customerText}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Rejected NL gaps */}
        {showRejected && rejectedCount > 0 && (
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
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">{t('summary.rejectedPoints')}</h3>
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
                    {comments[`gap-${index}`]?.internal && (
                      <div className="bg-muted/60 rounded px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Internal Note</p>
                        <p className="text-xs">{comments[`gap-${index}`].internal}</p>
                      </div>
                    )}
                    {comments[`gap-${index}`]?.external && (
                      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded px-3 py-2">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5">External Comment (in email)</p>
                        <p className="text-xs">{comments[`gap-${index}`].external}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Rejected caution points */}
        {showCautions && rejectedCautionItems.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Eye className="h-5 w-5 text-amber-500" />
                Rejected Points to Watch
              </h3>
              {rejectedCautionItems.map((item, index) => (
                <div key={index} className="border-l-4 border-amber-500 pl-4 py-2 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{item.topic}</h4>
                    <Badge variant="outline" className="text-[10px]">{item.section}</Badge>
                  </div>
                  <p className="text-xs italic text-muted-foreground">"{item.excerpt}"</p>
                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                  {comments[`caution-${index}`]?.internal && (
                    <div className="bg-muted/60 rounded px-3 py-2">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Internal Note</p>
                      <p className="text-xs">{comments[`caution-${index}`].internal}</p>
                    </div>
                  )}
                  {comments[`caution-${index}`]?.external && (
                    <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded px-3 py-2">
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5">External Comment (in email)</p>
                      <p className="text-xs">{comments[`caution-${index}`].external}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Actions */}
        <Separator />
        <div className="space-y-3">
          {(rejectedCount > 0 || rejectedCautionItems.length > 0) && (
            <div className="flex gap-2">
              {emailTemplate ? (
                <>
                  <Button
                    onClick={() => setShowEmail(v => !v)}
                    variant="default"
                    className="flex-1"
                  >
                    {showEmail ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                    {showEmail ? 'Hide Email Draft' : 'View Email Draft'}
                  </Button>
                  <Button
                    onClick={generateEmailTemplate}
                    variant="outline"
                    disabled={isGenerating}
                    title="Regenerate email"
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={generateEmailTemplate}
                  variant="default"
                  className="flex-1"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('summary.generating')}</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />{t('summary.generateEmail')}</>
                  )}
                </Button>
              )}
              <Button onClick={onRestart} variant="outline" className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('summary.restart')}
              </Button>
            </div>
          )}
          {rejectedCount === 0 && rejectedCautionItems.length === 0 && (
            <Button onClick={onRestart} variant="outline" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('summary.restart')}
            </Button>
          )}
          <Button
            onClick={saveEvaluation}
            variant="secondary"
            className="w-full"
            disabled={isSaving || isSaved}
            size="lg"
          >
            {isSaving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('summary.saving')}</>
            ) : isSaved ? (
              <><CheckCircle2 className="h-4 w-4 mr-2" />{t('summary.saved')}</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" />{t('summary.saveEvaluation')}</>
            )}
          </Button>
        </div>

        {/* Inline email editor — shown when showEmail is true */}
        {showEmail && emailTemplate !== undefined && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('summary.emailTemplateTitle')}
                </h3>
                <div className="flex gap-2">
                  <Button onClick={generateEmailTemplate} variant="outline" size="sm" disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                  <Button onClick={copyToClipboard} variant="outline" size="sm">
                    <Copy className="h-3 w-3 mr-1" />
                    {t('summary.copyToClipboard')}
                  </Button>
                </div>
              </div>
              <Textarea
                value={emailTemplate}
                onChange={(e) => {
                  setEmailTemplate(e.target.value);
                  try { draftEmailStore.save(e.target.value); } catch { /* ignore */ }
                }}
                className="min-h-[320px] font-mono text-sm"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
