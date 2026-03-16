import { type CompletedEvaluation } from "@/lib/localStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, XCircle, Eye, FileText, AlertCircle, AlertTriangle, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EvaluationDetailProps {
  evaluation: CompletedEvaluation;
  onBack: () => void;
}

export default function EvaluationDetail({ evaluation, onBack }: EvaluationDetailProps) {
  const { t, i18n } = useTranslation();
  const gaps: any[] = evaluation.gaps || [];
  const decisions: Record<string, string> = evaluation.decisions || {};
  const acceptedGaps = gaps.filter((_, i) => decisions[i] === 'accept');
  const rejectedGaps = gaps.filter((_, i) => decisions[i] === 'reject');
  const comments = evaluation.comments || {};
  const allCautions: any[] = evaluation.all_caution_items || [];
  const rejectedSet = new Set((evaluation.rejected_caution_items || []).map((c: any) => c.topic + c.section));
  const rejectedCautions = allCautions.filter(c => rejectedSet.has(c.topic + c.section));
  const acceptedCautions = allCautions.filter(c => !rejectedSet.has(c.topic + c.section));
  const cautionIndexMap = new Map(allCautions.map((c, i) => [c.topic + c.section, i]));

  const getSeverityBorderColor = (s: string) =>
    s === 'KRITISCH' ? 'border-destructive' : s === 'MITTEL' ? 'border-orange-400' : 'border-blue-400';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('myProcesses.title')}
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-bold">{evaluation.title}</h2>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <Calendar className="h-3 w-3" />
          {new Date(evaluation.completed_at).toLocaleDateString(
            i18n.language === 'de' ? 'de-DE' : 'en-US',
            { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-3xl font-bold text-primary">{acceptedGaps.length}</div>
          <div className="text-sm text-muted-foreground mt-1">{t('summary.accepted')}</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-3xl font-bold text-destructive">{rejectedGaps.length}</div>
          <div className="text-sm text-muted-foreground mt-1">{t('summary.rejected')}</div>
        </div>
        <div className="text-center p-4 bg-amber-500/10 rounded-lg">
          <div className="text-3xl font-bold text-amber-600">{evaluation.cautions_rejected ?? 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Cautions Rejected</div>
        </div>
      </div>

      {/* Gap stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <div>
            <p className="text-xl font-bold">{evaluation.critical_gaps}</p>
            <p className="text-xs text-muted-foreground">{t('myProcesses.criticalGaps')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          <div>
            <p className="text-xl font-bold">{evaluation.medium_gaps}</p>
            <p className="text-xs text-muted-foreground">{t('myProcesses.mediumGaps')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
          <div>
            <p className="text-xl font-bold">{evaluation.low_gaps}</p>
            <p className="text-xs text-muted-foreground">{t('myProcesses.lowGaps')}</p>
          </div>
        </div>
      </div>

      {/* Rejected gaps */}
      {rejectedGaps.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {t('summary.rejectedPoints')} ({rejectedGaps.length})
            </h3>
            {rejectedGaps.map((gap: any, i: number) => {
              // find original index for comments
              const origIdx = gaps.findIndex((g, idx) => decisions[idx] === 'reject' && gaps.indexOf(g) === gaps.indexOf(rejectedGaps[i]));
              const gapOrigIdx = gaps.reduce<number[]>((acc, _, idx) => decisions[idx] === 'reject' ? [...acc, idx] : acc, [])[i];
              const comment = comments[`gap-${gapOrigIdx}`];
              return (
                <div key={i} className={`border-l-4 ${getSeverityBorderColor(gap.severity)} pl-4 py-3 space-y-2`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{gap.section}</span>
                    <Badge variant={gap.severity === 'KRITISCH' ? 'destructive' : 'outline'} className="text-[10px]">
                      {gap.severity}
                    </Badge>
                  </div>
                  <p className="text-sm">{gap.customerText}</p>
                  {gap.reasoning && <p className="text-xs text-muted-foreground italic">{gap.reasoning}</p>}
                  {comment?.internal && (
                    <div className="bg-muted/60 rounded px-3 py-2">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Internal Note</p>
                      <p className="text-xs">{comment.internal}</p>
                    </div>
                  )}
                  {comment?.external && (
                    <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded px-3 py-2">
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5">External Comment</p>
                      <p className="text-xs">{comment.external}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Accepted gaps */}
      {acceptedGaps.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {t('summary.accepted')} ({acceptedGaps.length})
            </h3>
            {acceptedGaps.map((gap: any, i: number) => (
              <div key={i} className="border-l-4 border-primary/40 pl-4 py-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{gap.section}</span>
                  <Badge variant="outline" className="text-[10px]">{gap.severity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{gap.customerText}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Caution points */}
      {allCautions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" />
              Caution Points ({allCautions.length})
            </h3>

            {rejectedCautions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rejected ({rejectedCautions.length})</p>
                {rejectedCautions.map((item: any, i: number) => {
                  const idx = cautionIndexMap.get(item.topic + item.section);
                  const comment = idx !== undefined ? comments[`caution-${idx}`] : undefined;
                  return (
                    <div key={i} className="border-l-4 border-amber-500 pl-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.topic}</span>
                        <Badge variant="outline" className="text-[10px]">{item.section}</Badge>
                      </div>
                      <p className="text-sm italic text-muted-foreground">"{item.excerpt}"</p>
                      <p className="text-sm text-muted-foreground">{item.reason}</p>
                      {comment?.internal && (
                        <div className="bg-muted/60 rounded px-3 py-2">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Internal Note</p>
                          <p className="text-xs">{comment.internal}</p>
                        </div>
                      )}
                      {comment?.external && (
                        <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded px-3 py-2">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5">External Comment</p>
                          <p className="text-xs">{comment.external}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {acceptedCautions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accepted ({acceptedCautions.length})</p>
                {acceptedCautions.map((item: any, i: number) => (
                  <div key={i} className="border-l-4 border-green-500/40 pl-4 py-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{item.topic}</span>
                      <Badge variant="outline" className="text-[10px]">{item.section}</Badge>
                    </div>
                    <p className="text-sm italic text-muted-foreground">"{item.excerpt}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Email template */}
      {evaluation.email_template && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Email Template
            </h3>
            <Textarea value={evaluation.email_template} readOnly className="min-h-[300px] font-mono text-sm" />
          </div>
        </>
      )}
    </div>
  );
}
