import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import GapReviewWizard from "./GapReviewWizard";
import ReviewSummary from "./ReviewSummary";

interface Gap {
  section: string;
  customerText: string;
  baselineText: string;
  recommendation: string;
  severity: "KRITISCH" | "MITTEL" | "GERING";
  explanation: string;
}

interface AnalysisResultsProps {
  analysisId: string | null;
}

const AnalysisResults = ({ analysisId }: AnalysisResultsProps) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"initial" | "review" | "summary">("initial");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, boolean>>({});

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
      setAnalysis(data);
      setPhase("initial");
      setCurrentIndex(0);
      setDecisions({});
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
  };

  const handleAccept = (index: number) => {
    setDecisions((prev) => ({ ...prev, [index]: true }));
  };

  const handleReject = (index: number) => {
    setDecisions((prev) => ({ ...prev, [index]: false }));
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < gaps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleComplete = () => {
    setPhase("summary");
  };

  const handleRestart = () => {
    setPhase("review");
    setCurrentIndex(0);
    setDecisions({});
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

  const gaps: Gap[] = analysis.gaps || [];

  if (gaps.length === 0) {
    return (
      <Card className="p-12 text-center max-w-4xl mx-auto">
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <div>
            <h4 className="text-xl font-semibold text-foreground mb-2">Keine Lücken gefunden</h4>
            <p className="text-muted-foreground">
              Ihr eigener Kodex erfüllt alle Anforderungen des Kunden vollständig.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Initial view with start button
  if (phase === "initial") {
    const criticalGaps = gaps.filter((gap) => gap.severity === "KRITISCH").length;
    const mediumGaps = gaps.filter((gap) => gap.severity === "MITTEL").length;
    const lowGaps = gaps.filter((gap) => gap.severity === "GERING").length;

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card className="p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">GAP-Analyse Bericht</h2>
              <p className="text-muted-foreground">
                Umfassender Vergleich der Lieferantenkodizes mit KI-gestützten Erkenntnissen
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
                <span className="text-sm font-medium text-foreground">Gesamtübereinstimmung</span>
                <span className="text-2xl font-bold text-primary">
                  {analysis.overall_compliance_percentage}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 border-destructive/20 bg-destructive/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Kritisch</p>
                    <p className="text-3xl font-bold text-destructive">{criticalGaps}</p>
                  </div>
                </Card>

                <Card className="p-4 border-warning/20 bg-warning/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Mittel</p>
                    <p className="text-3xl font-bold text-warning">{mediumGaps}</p>
                  </div>
                </Card>

                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Gering</p>
                    <p className="text-3xl font-bold text-primary">{lowGaps}</p>
                  </div>
                </Card>
              </div>

              <div className="pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground mb-2">Identifizierte Abweichungen</p>
                <p className="text-4xl font-bold text-foreground">{gaps.length}</p>
              </div>
            </div>

            <div className="pt-6">
              <Button onClick={handleStartReview} size="lg" className="w-full h-14 text-lg font-semibold">
                Bewertung starten
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Bewerten Sie jeden Punkt einzeln als akzeptabel oder nicht akzeptabel
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Review phase
  if (phase === "review") {
    return (
      <GapReviewWizard
        gaps={gaps}
        currentIndex={currentIndex}
        decisions={decisions}
        onAccept={handleAccept}
        onReject={handleReject}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onComplete={handleComplete}
      />
    );
  }

  // Summary phase
  return (
    <ReviewSummary
      gaps={gaps}
      decisions={decisions}
      overallCompliance={analysis.overall_compliance_percentage}
      onRestart={handleRestart}
    />
  );
};

export default AnalysisResults;
