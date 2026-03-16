import { useEffect, useState } from "react";
import { completedEvaluationStore, type CompletedEvaluation } from "@/lib/localStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, Calendar, AlertCircle, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

interface MyProcessesProps {
  onViewDetail?: (evaluation: CompletedEvaluation) => void;
}

export default function MyProcesses({ onViewDetail }: MyProcessesProps) {
  const [evaluations, setEvaluations] = useState<CompletedEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<CompletedEvaluation | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    setEvaluations(completedEvaluationStore.getAll());
    setLoading(false);
  }, []);

  const handleDelete = () => {
    if (!deleteId) return;
    completedEvaluationStore.delete(deleteId);
    setEvaluations(evaluations.filter((e) => e.id !== deleteId));
    toast({ title: t('myProcesses.deleted'), description: t('toast.processDeleted') });
    setDeleteId(null);
  };

  const copyEmailTemplate = () => {
    if (selectedEvaluation?.email_template) {
      navigator.clipboard.writeText(selectedEvaluation.email_template);
      toast({ title: t('myProcesses.copied'), description: t('toast.emailTemplateCopied') });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('myProcesses.noProcesses')}</p>
          <p className="text-sm text-muted-foreground mt-2">{t('myProcesses.noProcessesDesc')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('myProcesses.title')}</h2>
        <Badge variant="secondary">{evaluations.length} {t('myProcesses.processes')}</Badge>
      </div>

      {evaluations.map((evaluation) => (
        <Card
          key={evaluation.id}
          className="hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => onViewDetail?.(evaluation)}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {evaluation.title}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(evaluation.completed_at).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US', {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(evaluation.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{evaluation.critical_gaps}</p>
                  <p className="text-xs text-muted-foreground">{t('myProcesses.criticalGaps')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{evaluation.medium_gaps}</p>
                  <p className="text-xs text-muted-foreground">{t('myProcesses.mediumGaps')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{evaluation.low_gaps}</p>
                  <p className="text-xs text-muted-foreground">{t('myProcesses.lowGaps')}</p>
                </div>
              </div>
            </div>

            {(evaluation.cautions_accepted !== undefined || evaluation.cautions_rejected !== undefined) && (
              <div className="border-t pt-3 grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{evaluation.cautions_accepted ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Cautions Accepted</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{evaluation.cautions_rejected ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Cautions Rejected</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setSelectedEvaluation(evaluation); setShowEmailDialog(true); }}
                disabled={!evaluation.email_template}
              >
                <FileText className="h-4 w-4 mr-2" />
                {t('myProcesses.viewEmail')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('myProcesses.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('myProcesses.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('myProcesses.emailDialogTitle')}</DialogTitle>
            <DialogDescription>{selectedEvaluation?.title}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={selectedEvaluation?.email_template || ""}
            readOnly
            className="min-h-[400px] font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>{t('common.close')}</Button>
            <Button onClick={copyEmailTemplate}>{t('summary.copyToClipboard')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
