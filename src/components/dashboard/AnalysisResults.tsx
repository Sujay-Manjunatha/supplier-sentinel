import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import GapReviewWizard from "./GapReviewWizard";
import { ReviewSummary } from "./ReviewSummary";

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
      <Card className="p-6 max-w-4xl mx-auto">
        <p className="text-center text-muted-foreground">Analyse wird geladen...</p>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="p-6 max-w-4xl mx-auto">
        <p className="text-center text-muted-foreground">Keine Analyse ausgewählt</p>
      </Card>
    );
  }

  const gaps: Gap[] = sortedGaps;

  if (gaps.length === 0) {
    return (
      <Card className="p-12 text-center max-w-4xl mx-auto">
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <div>
            <h4 className="text-xl font-semibold text-foreground mb-2">Keine Übereinstimmungen gefunden</h4>
            <p className="text-muted-foreground">
              Das Kundendokument enthält keine Punkte, die mit Ihrer Negativliste übereinstimmen.
            </p>
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
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card className="p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Analyse-Ergebnis</h2>
              <p className="text-muted-foreground">
                Prüfung gegen Ihre Negativliste abgeschlossen
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 border-destructive/20 bg-destructive/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Hohe Übereinstimmung</p>
                    <p className="text-3xl font-bold text-destructive">{criticalGaps}</p>
                  </div>
                </Card>

                <Card className="p-4 border-orange-500/20 bg-orange-500/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Mittlere Übereinstimmung</p>
                    <p className="text-3xl font-bold text-orange-500">{mediumGaps}</p>
                  </div>
                </Card>

                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Niedrige Übereinstimmung</p>
                    <p className="text-3xl font-bold text-primary">{lowGaps}</p>
                  </div>
                </Card>
              </div>

              <div className="pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground mb-2">Gefundene Treffer</p>
                <p className="text-4xl font-bold text-foreground">{gaps.length}</p>
              </div>
            </div>

            <div className="pt-6">
              <Button onClick={handleStartReview} size="lg" className="w-full h-14 text-lg font-semibold">
                Bewertung starten
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Bewerten Sie jeden Treffer einzeln als akzeptabel oder nicht akzeptabel
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