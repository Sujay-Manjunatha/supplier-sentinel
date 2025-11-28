import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import GapReviewWizard from "./GapReviewWizard";
import { ReviewSummary } from "./ReviewSummary";
import { useTranslation } from "react-i18next";

interface Gap {
  section: string;
  customerText: string;
  gapType: 'negative_match';
  severity: "KRITISCH" | "MITTEL" | "GERING";
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

interface AnalysisResultsProps {
  analysisId: string | null;
  comparisonDocumentId?: string | null;
}

const AnalysisResults = ({ analysisId, comparisonDocumentId }: AnalysisResultsProps) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"initial" | "review" | "summary">("initial");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, 'accept' | 'reject'>>({});
  const [skippedIndices, setSkippedIndices] = useState<number[]>([]);
  const [sortedGaps, setSortedGaps] = useState<Gap[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    if (analysisId) {
      fetchAnalysis();
    }
  }, [analysisId]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("gap_analyses")
        .select("*")
        .eq("id", analysisId)
        .single();

      if (error) throw error;

      const gaps = (data.gaps as any[]) || [];
      const sorted = gaps.sort((a: any, b: any) => {
        const order = { 'KRITISCH': 0, 'MITTEL': 1, 'GERING': 2 };
        return order[a.severity] - order[b.severity];
      });

      setSortedGaps(sorted as Gap[]);
      setAnalysis({ ...data, gaps: sorted });
      
      setPhase("initial");
      setCurrentIndex(0);
      setDecisions({});
      setSkippedIndices([]);
    } catch (error) {
      console.error("Error fetching analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = () => {
    setPhase("review");
    setCurrentIndex(0);
    setDecisions({});
    setSkippedIndices([]);
  };

  const handleAccept = (index: number) => {
    setDecisions((prev) => ({ ...prev, [index]: 'accept' }));
    setSkippedIndices((prev) => prev.filter((i) => i !== index));
  };

  const handleReject = (index: number) => {
    setDecisions((prev) => ({ ...prev, [index]: 'reject' }));
    setSkippedIndices((prev) => prev.filter((i) => i !== index));
  };

  const handleSkip = (index: number) => {
    if (!skippedIndices.includes(index)) {
      setSkippedIndices((prev) => [...prev, index]);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < sortedGaps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleJumpTo = (index: number) => {
    setCurrentIndex(index);
  };

  const handleComplete = () => {
    const unansweredSkipped = skippedIndices.filter((i) => decisions[i] === undefined);
    
    if (unansweredSkipped.length > 0 && Object.keys(decisions).length < sortedGaps.length) {
      setCurrentIndex(unansweredSkipped[0]);
    } else {
      setPhase("summary");
    }
  };

  const handleRestart = () => {
    setPhase("review");
    setCurrentIndex(0);
    setDecisions({});
    setSkippedIndices([]);
  };

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

  const gaps: Gap[] = sortedGaps;

  if (gaps.length === 0) {
    return (
      <Card className="p-12 text-center w-full max-w-4xl mx-auto">
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <div>
            <h4 className="text-xl font-semibold text-foreground mb-2">{t('analysis.noGaps')}</h4>
            <p className="text-muted-foreground">{t('analysis.noGapsDesc')}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "initial") {
    const criticalGaps = gaps.filter((gap) => gap.severity === "KRITISCH").length;
    const mediumGaps = gaps.filter((gap) => gap.severity === "MITTEL").length;
    const lowGaps = gaps.filter((gap) => gap.severity === "GERING").length;

    return (
      <div className="space-y-4 w-full max-w-4xl mx-auto">
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">{t('analysis.title')}</h2>
              <p className="text-muted-foreground">{t('analysis.description')}</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4 border-destructive/20 bg-destructive/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">{t('analysis.criticalGaps')}</p>
                    <p className="text-3xl font-bold text-destructive">{criticalGaps}</p>
                  </div>
                </Card>

                <Card className="p-4 border-orange-500/20 bg-orange-500/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">{t('analysis.mediumGaps')}</p>
                    <p className="text-3xl font-bold text-orange-500">{mediumGaps}</p>
                  </div>
                </Card>

                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">{t('analysis.lowGaps')}</p>
                    <p className="text-3xl font-bold text-primary">{lowGaps}</p>
                  </div>
                </Card>
              </div>

              <div className="pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('analysis.totalMatches')}</p>
                <p className="text-4xl font-bold text-foreground">{gaps.length}</p>
              </div>
            </div>

            <div className="pt-6">
              <Button onClick={handleStartReview} size="lg" className="w-full h-14 text-lg font-semibold">
                {t('analysis.startReview')}
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-4">
                {t('analysis.startReviewDesc')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <GapReviewWizard
        gaps={gaps}
        currentIndex={currentIndex}
        decisions={decisions}
        skippedIndices={skippedIndices}
        onAccept={handleAccept}
        onReject={handleReject}
        onSkip={handleSkip}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onJumpTo={handleJumpTo}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <ReviewSummary
      gaps={gaps}
      decisions={decisions}
      analysisId={analysisId}
      comparisonDocumentId={comparisonDocumentId || analysis.comparison_document_id}
      onRestart={handleRestart}
    />
  );
};

export default AnalysisResults;
