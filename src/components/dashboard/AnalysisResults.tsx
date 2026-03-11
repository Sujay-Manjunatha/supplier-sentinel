import { useEffect, useState } from "react";
import { gapAnalysisStore, comparisonDocStore, negativeListStore } from "@/lib/localStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import GapReviewWizard from "./GapReviewWizard";
import { ReviewSummary } from "./ReviewSummary";
import { RejectedPointsCommentReview } from "./RejectedPointsCommentReview";
import type { CommentsMap } from "./RejectedPointsCommentReview";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Eye, Plus, ChevronRight, ChevronLeft, FileText, AlertCircle, RefreshCw, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CautionItem } from "@/lib/gemini";

interface Gap {
  section: string;
  customerText: string;
  gapType: 'negative_match';
  severity: "KRITISCH" | "MITTEL" | "GERING";
  aiRecommendation: string;
  ownCodexCoverage: string;
  reasoning: string;
  risksIfAccepted: string;
  matchedNegativePoint?: { title: string; description: string; };
  matchConfidence?: 'HOCH' | 'MITTEL' | 'NIEDRIG';
}

interface AnalysisResultsProps {
  analysisId: string | null;
  comparisonDocumentId?: string | null;
}

type Phase = "initial" | "review" | "cautions" | "comment-review" | "summary";
type CautionDecision = 'accept' | 'reject' | 'reject_add_nl';

const AnalysisResults = ({ analysisId, comparisonDocumentId }: AnalysisResultsProps) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("initial");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, 'accept' | 'reject'>>({});
  const [skippedIndices, setSkippedIndices] = useState<number[]>([]);
  const [sortedGaps, setSortedGaps] = useState<Gap[]>([]);
  const [cautionItems, setCautionItems] = useState<CautionItem[]>([]);
  const [rejectedCautionItems, setRejectedCautionItems] = useState<CautionItem[]>([]);
  const [pointComments, setPointComments] = useState<CommentsMap>({});
  const [documentContent, setDocumentContent] = useState<string>('');
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (analysisId) fetchAnalysis();
  }, [analysisId]);

  const fetchAnalysis = () => {
    setLoading(true);
    try {
      const data = gapAnalysisStore.getById(analysisId!);
      if (!data) throw new Error('Analysis not found');

      const gaps = (data.gaps as any[]) || [];
      const sorted = gaps.sort((a: any, b: any) => {
        const order: Record<string, number> = { 'KRITISCH': 0, 'MITTEL': 1, 'GERING': 2 };
        return order[a.severity] - order[b.severity];
      });

      setSortedGaps(sorted as Gap[]);
      setAnalysis({ ...data, gaps: sorted });
      setCautionItems((data.caution_items as CautionItem[]) || []);
      setPhase("initial");
      setCurrentIndex(0);
      setDecisions({});
      setSkippedIndices([]);

      // Load document for split view
      const docId = comparisonDocumentId || data.comparison_document_id;
      if (docId) {
        const doc = comparisonDocStore.getById(docId);
        if (doc) {
          setDocumentContent(doc.content);
          setFileDataUrl(doc.file_data_url || null);
        }
      }
    } catch (error) {
      console.error("Error fetching analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = () => {
    if (sortedGaps.length === 0) {
      setPhase("cautions");
    } else {
      setPhase("review");
      setCurrentIndex(0);
      setDecisions({});
      setSkippedIndices([]);
    }
  };

  const handleReviewComplete = () => {
    try {
      setPhaseError(null);
      setPhase("cautions");
    } catch (e: any) {
      console.error("Error transitioning to cautions phase:", e);
      setPhaseError(e?.message || "An error occurred. Please try again.");
    }
  };
  const handleCautionsComplete = (cautionDecisions: Record<number, CautionDecision>) => {
    try {
      setPhaseError(null);
      const rejected: CautionItem[] = [];
      cautionItems.forEach((item, i) => {
        const decision = cautionDecisions[i];
        if (decision === 'reject_add_nl') {
          handleAddCautionToNL(item);
          rejected.push(item);
        } else if (decision === 'reject') {
          rejected.push(item);
        }
        // 'accept' — user is fine with it, no action
      });
      setRejectedCautionItems(rejected);
      setPointComments({});
      setPhase("comment-review");
    } catch (e: any) {
      console.error("Error transitioning to summary phase:", e);
      setPhaseError(e?.message || "An error occurred. Please try again.");
    }
  };
  const handleCommentsComplete = (comments: CommentsMap) => {
    setPointComments(comments);
    setPhase("summary");
  };

  const handleRestart = () => {
    try {
      setPhaseError(null);
      setPhase("review");
      setCurrentIndex(0);
      setDecisions({});
      setSkippedIndices([]);
    } catch (e: any) {
      console.error("Error restarting review:", e);
      setPhaseError(e?.message || "An error occurred. Please try again.");
    }
  };

  const handleAddCautionToNL = (item: CautionItem) => {
    const docType = analysis?.document_type || 'supplier_code';
    negativeListStore.insert([{
      user_id: 'local',
      document_type: docType,
      title: item.suggestedTitle || item.topic,
      description: item.suggestedDescription || item.reason,
      category: 'Sonstiges',
      source: 'review',
    }]);
    toast.success(`"${item.topic}" added to negative list`);
  };

  if (!analysisId) {
    return (
      <Card className="p-6 w-full max-w-4xl mx-auto">
        <p className="text-center text-muted-foreground">{t('analysis.noAnalysis')}</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-6 w-full max-w-4xl mx-auto">
        <p className="text-center text-muted-foreground">{t('analysis.loading')}</p>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="p-6 w-full max-w-4xl mx-auto">
        <p className="text-center text-muted-foreground">{t('analysis.noAnalysis')}</p>
      </Card>
    );
  }

  // ── Comment review phase (full width) ────────────────────────────────────
  if (phase === "comment-review") {
    const rejectedGaps = sortedGaps.filter((_, index) => decisions[index] === 'reject');
    return (
      <RejectedPointsCommentReview
        rejectedGaps={rejectedGaps}
        rejectedCautionItems={rejectedCautionItems}
        onComplete={handleCommentsComplete}
      />
    );
  }

  // ── Summary phase (full width) ────────────────────────────────────────────
  if (phase === "summary") {
    return (
      <ReviewSummary
        gaps={sortedGaps}
        decisions={decisions}
        analysisId={analysisId}
        comparisonDocumentId={comparisonDocumentId || analysis.comparison_document_id}
        onRestart={handleRestart}
        rejectedCautionItems={rejectedCautionItems}
        comments={pointComments}
      />
    );
  }

  // ── Split-view wrapper for all other phases ───────────────────────────────
  return (
    <div className="flex gap-4 w-full" style={{ height: 'calc(100vh - 140px)' }}>
      {/* LEFT: Document viewer */}
      <div className="w-1/2 flex flex-col min-h-0">
        <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Document</span>
          </div>
          {fileDataUrl ? (
            <iframe
              src={fileDataUrl}
              className="flex-1 w-full border-0"
              title="Document Preview"
            />
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              <pre className="text-xs whitespace-pre-wrap p-4 font-mono leading-relaxed text-foreground/80">
                {documentContent || 'Document content not available.'}
              </pre>
            </ScrollArea>
          )}
        </Card>
      </div>

      {/* RIGHT: Review panel */}
      <div className="w-1/2 flex flex-col min-h-0 overflow-y-auto">
        {phaseError && (
          <Card className="p-6 m-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Something went wrong</h3>
                <p className="text-sm text-muted-foreground mb-3">{phaseError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setPhaseError(null); setPhase("initial"); }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Back to overview
                </Button>
              </div>
            </div>
          </Card>
        )}
        {!phaseError && phase === "initial" && (
          <InitialPanel
            gaps={sortedGaps}
            cautionItems={cautionItems}
            onStartReview={handleStartReview}
            t={t}
          />
        )}

        {!phaseError && phase === "review" && (
          <GapReviewWizard
            gaps={sortedGaps}
            currentIndex={currentIndex}
            decisions={decisions}
            skippedIndices={skippedIndices}
            onAccept={(i) => {
              setDecisions(prev => ({ ...prev, [i]: 'accept' }));
              setSkippedIndices(prev => prev.filter(x => x !== i));
            }}
            onReject={(i) => {
              setDecisions(prev => ({ ...prev, [i]: 'reject' }));
              setSkippedIndices(prev => prev.filter(x => x !== i));
            }}
            onSkip={(i) => {
              if (!skippedIndices.includes(i)) setSkippedIndices(prev => [...prev, i]);
            }}
            onPrevious={() => setCurrentIndex(i => Math.max(0, i - 1))}
            onNext={() => setCurrentIndex(i => Math.min(sortedGaps.length - 1, i + 1))}
            onJumpTo={setCurrentIndex}
            onComplete={handleReviewComplete}
          />
        )}

        {!phaseError && phase === "cautions" && (
          <CautionsPanel
            cautionItems={cautionItems}
            gaps={sortedGaps}
            onComplete={handleCautionsComplete}
            t={t}
          />
        )}
      </div>
    </div>
  );
};

// ── InitialPanel ─────────────────────────────────────────────────────────────

const InitialPanel = ({
  gaps,
  cautionItems,
  onStartReview,
  t,
}: {
  gaps: Gap[];
  cautionItems: CautionItem[];
  onStartReview: () => void;
  t: (key: string) => string;
}) => {
  const criticalGaps = gaps.filter(g => g.severity === "KRITISCH").length;
  const mediumGaps = gaps.filter(g => g.severity === "MITTEL").length;
  const lowGaps = gaps.filter(g => g.severity === "GERING").length;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">{t('analysis.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('analysis.description')}</p>
          </div>

          {gaps.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4 border-destructive/20 bg-destructive/5 text-center">
                  <p className="text-xs font-medium text-muted-foreground">{t('analysis.criticalGaps')}</p>
                  <p className="text-3xl font-bold text-destructive">{criticalGaps}</p>
                </Card>
                <Card className="p-4 border-orange-500/20 bg-orange-500/5 text-center">
                  <p className="text-xs font-medium text-muted-foreground">{t('analysis.mediumGaps')}</p>
                  <p className="text-3xl font-bold text-orange-500">{mediumGaps}</p>
                </Card>
                <Card className="p-4 border-primary/20 bg-primary/5 text-center">
                  <p className="text-xs font-medium text-muted-foreground">{t('analysis.lowGaps')}</p>
                  <p className="text-3xl font-bold text-primary">{lowGaps}</p>
                </Card>
              </div>
              <div className="pt-2 border-t text-center">
                <p className="text-xs text-muted-foreground mb-1">{t('analysis.totalMatches')}</p>
                <p className="text-4xl font-bold text-foreground">{gaps.length}</p>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <h3 className="text-lg font-semibold mb-1">{t('analysis.noGaps')}</h3>
              <p className="text-sm text-muted-foreground">{t('analysis.noGapsDesc')}</p>
            </div>
          )}

          {cautionItems.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>{cautionItems.length}</strong> additional points worth reviewing were found outside your negative list.
              </p>
            </div>
          )}

          <Button onClick={onStartReview} size="lg" className="w-full h-12 font-semibold">
            {gaps.length > 0 ? t('analysis.startReview') : 'Review Caution Items'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground text-center">{t('analysis.startReviewDesc')}</p>
        </div>
      </Card>
    </div>
  );
};

// ── CautionsPanel ─────────────────────────────────────────────────────────────

const CautionsPanel = ({
  cautionItems: rawCautionItems,
  onComplete,
}: {
  cautionItems: CautionItem[];
  gaps: Gap[];
  onComplete: (decisions: Record<number, CautionDecision>) => void;
  t: (key: string) => string;
}) => {
  const cautionItems = Array.isArray(rawCautionItems) ? rawCautionItems : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, CautionDecision>>({});

  if (cautionItems.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Points to Watch</h3>
            <p className="text-sm text-muted-foreground mb-6">No additional caution points were found outside your negative list.</p>
            <Button onClick={() => onComplete({})} size="lg" className="font-semibold">
              Continue to Summary
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentItem = cautionItems[currentIndex];
  const currentDecision = decisions[currentIndex];
  const isLast = currentIndex === cautionItems.length - 1;
  const progress = ((currentIndex + 1) / cautionItems.length) * 100;

  const setDecision = (decision: CautionDecision) => {
    setDecisions(prev => ({ ...prev, [currentIndex]: decision }));
  };

  const handleComplete = () => {
    onComplete(decisions);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Progress Header */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Points to Watch</h2>
            <span className="text-lg font-semibold text-muted-foreground">
              {currentIndex + 1} of {cautionItems.length}
            </span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      </Card>

      {/* Current Item Card */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Eye className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-2xl font-bold text-foreground">{currentItem.topic}</h3>
                <Badge variant="outline">{currentItem.section}</Badge>
              </div>
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Relevant Excerpt</h4>
            <p className="text-sm italic text-muted-foreground bg-muted p-3 rounded-md">
              "{currentItem.excerpt}"
            </p>
          </div>

          {/* Reason */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Why This Matters</h4>
            <p className="text-sm bg-muted p-3 rounded-md">{currentItem.reason}</p>
          </div>

          {/* Decision Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setDecision('accept')}
              variant={currentDecision === 'accept' ? "default" : "outline"}
              className={cn("flex-1", currentDecision === 'accept' && "bg-green-600 hover:bg-green-700 text-white")}
            >
              <Check className="h-4 w-4 mr-2" />
              Accept
            </Button>
            <Button
              onClick={() => setDecision('reject')}
              variant={currentDecision === 'reject' ? "default" : "outline"}
              className={cn("flex-1", currentDecision === 'reject' && "bg-red-600 hover:bg-red-700 text-white")}
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => setDecision('reject_add_nl')}
              variant={currentDecision === 'reject_add_nl' ? "default" : "outline"}
              className={cn("flex-1", currentDecision === 'reject_add_nl' && "bg-amber-600 hover:bg-amber-700 text-white")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Reject + Add to NL
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              variant="outline"
              disabled={currentIndex === 0}
              size="lg"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Previous
            </Button>

            {!isLast ? (
              <Button
                onClick={() => setCurrentIndex(i => i + 1)}
                variant={currentDecision ? "default" : "outline"}
                disabled={!currentDecision}
                size="lg"
              >
                Next
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                size="lg"
                className="font-semibold"
              >
                Continue to Summary
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AnalysisResults;
