import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, AlertTriangle, Info, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Lightbulb, Circle, SkipForward, Copy, Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface Gap {
  section: string;
  customerText: string;
  gapType: string;
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

interface GapReviewWizardProps {
  gaps: Gap[];
  currentIndex: number;
  decisions: Record<number, 'accept' | 'reject'>;
  skippedIndices: number[];
  onAccept: (index: number) => void;
  onReject: (index: number) => void;
  onSkip: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onJumpTo: (index: number) => void;
  onComplete: () => void;
}

const GapReviewWizard = ({
  gaps,
  currentIndex,
  decisions,
  skippedIndices,
  onAccept,
  onReject,
  onSkip,
  onPrevious,
  onNext,
  onJumpTo,
  onComplete,
}: GapReviewWizardProps) => {
  const { t } = useTranslation();
  const currentGap = gaps[currentIndex];
  const isLastGap = currentIndex === gaps.length - 1;
  const currentDecision = decisions[currentIndex];
  const allDecisionsMade = gaps.every((_, index) => decisions[index] !== undefined);
  const hasUnansweredQuestions = !allDecisionsMade;
  const progress = ((currentIndex + 1) / gaps.length) * 100;
  const [showIncompleteDialog, setShowIncompleteDialog] = useState(false);

  const handleAccept = () => {
    onAccept(currentIndex);
  };

  const handleReject = () => {
    onReject(currentIndex);
  };

  const handleSkip = () => {
    onSkip(currentIndex);
    if (currentIndex < gaps.length - 1) {
      onNext();
    }
  };

  const handleCompleteClick = () => {
    try {
      if (hasUnansweredQuestions) {
        setShowIncompleteDialog(true);
      } else {
        onComplete();
      }
    } catch (e) {
      console.error("Error completing review:", e);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "KRITISCH":
        return <AlertCircle className="h-6 w-6 text-destructive" />;
      case "MITTEL":
        return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      case "GERING":
        return <Info className="h-6 w-6 text-blue-500" />;
      default:
        return <Info className="h-6 w-6" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      'KRITISCH': 'destructive' as const,
      'MITTEL': 'default' as const,
      'GERING': 'secondary' as const,
    };
    return variants[severity as keyof typeof variants] || 'default' as const;
  };

  const getStatusIcon = (index: number) => {
    if (decisions[index] === 'accept') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (decisions[index] === 'reject') return <XCircle className="h-4 w-4 text-red-500" />;
    if (skippedIndices.includes(index)) return <SkipForward className="h-4 w-4 text-orange-500" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4 w-full">
      {/* Progress Header */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">{t('review.title')}</h2>
            <span className="text-lg font-semibold text-muted-foreground">
              {currentIndex + 1} {t('review.of')} {gaps.length}
            </span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      </Card>

      <div>
        {/* Current Gap Card */}
        <div className="space-y-4">
          <Card className="p-6">
            <div className="space-y-6">
              {/* Header with Severity */}
              <div className="flex items-start gap-4">
                {getSeverityIcon(currentGap.severity)}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl font-bold text-foreground">{currentGap.section}</h3>
                    <Badge variant={getSeverityBadge(currentGap.severity)}>
                      {t(`analysis.severity.${currentGap.severity}`)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Content sections */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">{t('review.customerRequirement')}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(currentGap.customerText);
                        toast.success(t('toast.copiedToClipboard'));
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm">{currentGap.customerText}</p>
                </div>

                {currentGap.matchedNegativePoint && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('review.matchedNegativePoint')}</h3>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{currentGap.matchedNegativePoint.title}</p>
                      <p className="text-sm text-muted-foreground">{currentGap.matchedNegativePoint.description}</p>
                    </div>
                  </div>
                )}

                {currentGap.matchConfidence && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('review.matchConfidence')}</h3>
                    <Badge variant={currentGap.matchConfidence === 'HOCH' ? 'destructive' : currentGap.matchConfidence === 'MITTEL' ? 'default' : 'secondary'}>
                      {t(`review.confidence.${currentGap.matchConfidence}`)}
                    </Badge>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    {t('review.reasoning')}
                  </h3>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {currentGap.reasoning}
                  </p>
                </div>
              </div>

              {/* Decision Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleAccept}
                  variant={currentDecision === 'accept' ? "default" : "outline"}
                  className={cn(
                    "flex-1",
                    currentDecision === 'accept' && "bg-green-600 hover:bg-green-700 text-white"
                  )}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {t('review.accept')}
                </Button>
                <Button
                  onClick={handleReject}
                  variant={currentDecision === 'reject' ? "default" : "outline"}
                  className={cn(
                    "flex-1",
                    currentDecision === 'reject' && "bg-red-600 hover:bg-red-700 text-white"
                  )}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('review.reject')}
                </Button>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  onClick={onPrevious}
                  variant="outline"
                  disabled={currentIndex === 0}
                  size="lg"
                >
                  <ChevronLeft className="h-5 w-5 mr-2" />
                  {t('review.previous')}
                </Button>

                {!isLastGap ? (
                  <Button
                    onClick={onNext}
                    variant={currentDecision ? "default" : "outline"}
                    disabled={!currentDecision}
                    size="lg"
                  >
                    {t('review.next')}
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleCompleteClick}
                    size="lg"
                    className="font-semibold"
                  >
                    {t('review.complete')}
                  </Button>
                )}
              </div>

              {/* Skip Button */}
              <Button
                onClick={handleSkip}
                variant="ghost"
                className="w-full"
                size="sm"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                {t('review.skip')}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Incomplete Review Dialog */}
      <AlertDialog open={showIncompleteDialog} onOpenChange={setShowIncompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('review.unansweredTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('review.unansweredDesc')} {Object.keys(decisions).length} {t('review.of')} {gaps.length} {t('review.answeredCount')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('review.continueReview')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { try { onComplete(); } catch (e) { console.error(e); toast.error("Something went wrong. Please try again."); } }}>
              {t('review.completeAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GapReviewWizard;