import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, AlertTriangle, Info, ChevronLeft, ChevronRight, FileText, CheckCircle2, XCircle, Lightbulb, Star, Circle, SkipForward } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Gap {
  section: string;
  customerText: string;
  severity: 'KRITISCH' | 'MITTEL' | 'GERING';
  aiRecommendation: 'AKZEPTIEREN' | 'ABLEHNEN' | 'PRÜFEN';
  reasoning: string;
  risksIfAccepted: string;
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
  const currentGap = gaps[currentIndex];
  const isLastGap = currentIndex === gaps.length - 1;
  const currentDecision = decisions[currentIndex];
  const allDecisionsMade = gaps.every((_, index) => decisions[index] !== undefined);
  const hasUnansweredQuestions = !allDecisionsMade;
  const progress = ((currentIndex + 1) / gaps.length) * 100;
  const [showPermanentDialog, setShowPermanentDialog] = useState(false);
  const [showIncompleteDialog, setShowIncompleteDialog] = useState(false);

  const hashText = async (text: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleAccept = () => {
    onAccept(currentIndex);
  };

  const handlePermanentAccept = () => {
    setShowPermanentDialog(true);
  };

  const handleConfirmPermanentAccept = async () => {
    const hash = await hashText(currentGap.customerText);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Nicht authentifiziert");
      return;
    }

    // Try to infer category from section
    const category = inferCategory(currentGap.section);

    const { error } = await supabase
      .from('accepted_requirements')
      .insert({
        user_id: user.id,
        section: currentGap.section,
        requirement_text: currentGap.customerText,
        requirement_hash: hash,
        category: category,
        notes: 'Dauerhaft akzeptiert'
      });

    if (error) {
      console.error('Error saving permanent acceptance:', error);
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Dauerhaft akzeptiert und gespeichert");
      onAccept(currentIndex);
      setShowPermanentDialog(false);
      
      // Auto-advance to next question
      if (currentIndex < gaps.length - 1) {
        setTimeout(() => onNext(), 500);
      }
    }
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
    if (hasUnansweredQuestions) {
      setShowIncompleteDialog(true);
    } else {
      onComplete();
    }
  };

  const inferCategory = (section: string): string => {
    const lower = section.toLowerCase();
    if (lower.includes('umwelt') || lower.includes('klima') || lower.includes('esg')) return 'ESG & Umwelt';
    if (lower.includes('qualität') || lower.includes('produkt')) return 'Qualität';
    if (lower.includes('arbeit') || lower.includes('sicher') || lower.includes('gesundheit')) return 'Arbeitsbedingungen';
    if (lower.includes('ethik') || lower.includes('korruption') || lower.includes('compliance')) return 'Ethik & Compliance';
    if (lower.includes('daten') || lower.includes('privacy') || lower.includes('schutz')) return 'Datenschutz';
    return 'Allgemein';
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

  const getRecommendationBadge = (recommendation: string) => {
    const variants = {
      'AKZEPTIEREN': 'default' as const,
      'ABLEHNEN': 'destructive' as const,
      'PRÜFEN': 'secondary' as const,
    };
    return variants[recommendation as keyof typeof variants] || 'secondary' as const;
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'AKZEPTIEREN':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'ABLEHNEN':
        return <XCircle className="h-4 w-4" />;
      case 'PRÜFEN':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (index: number) => {
    if (decisions[index] === 'accept') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (decisions[index] === 'reject') return <XCircle className="h-4 w-4 text-red-500" />;
    if (skippedIndices.includes(index)) return <SkipForward className="h-4 w-4 text-orange-500" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Progress Header */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Punkt-für-Punkt Bewertung</h2>
            <span className="text-lg font-semibold text-muted-foreground">
              {currentIndex + 1} von {gaps.length}
            </span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Overview Sidebar */}
        <Card className="p-4 lg:col-span-1 h-fit">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Übersicht
          </h3>
          <ScrollArea className="h-[500px] pr-3">
            <div className="space-y-1">
              {gaps.map((gap, index) => (
                <button
                  key={index}
                  onClick={() => onJumpTo(index)}
                  className={cn(
                    "w-full text-left text-xs p-3 rounded-md transition-colors flex items-start gap-2",
                    currentIndex === index && "bg-primary/10 border border-primary/20",
                    currentIndex !== index && "hover:bg-muted/50"
                  )}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getStatusIcon(index)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{gap.section}</div>
                    <Badge variant={getSeverityBadge(gap.severity)} className="mt-1 text-[10px] h-4">
                      {gap.severity}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Current Gap Card */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="p-8">
            <div className="space-y-6">
              {/* Header with Severity */}
              <div className="flex items-start gap-4">
                {getSeverityIcon(currentGap.severity)}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl font-bold text-foreground">{currentGap.section}</h3>
                    <Badge variant={getSeverityBadge(currentGap.severity)}>
                      {currentGap.severity}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Content sections */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    {getRecommendationIcon(currentGap.aiRecommendation)}
                    KI-Empfehlung
                  </h3>
                  <Badge variant={getRecommendationBadge(currentGap.aiRecommendation)}>
                    KI empfiehlt: {currentGap.aiRecommendation}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Kundenanforderung
                  </h3>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {currentGap.customerText}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    KI-Begründung
                  </h3>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {currentGap.reasoning}
                  </p>
                </div>

                {currentGap.risksIfAccepted && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Risiken bei Akzeptanz
                    </h3>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      {currentGap.risksIfAccepted}
                    </p>
                  </div>
                )}
              </div>

              {/* Decision Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleAccept}
                  className={cn(
                    "flex-1",
                    currentDecision === 'accept' && "ring-2 ring-green-500 ring-offset-2"
                  )}
                  variant={currentDecision === 'accept' ? "default" : "outline"}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Akzeptieren
                </Button>
                <Button
                  onClick={handlePermanentAccept}
                  className="flex-1"
                  variant="default"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Dauerhaft akzeptieren
                </Button>
                <Button
                  onClick={handleReject}
                  variant={currentDecision === 'reject' ? "destructive" : "outline"}
                  className={cn(
                    "flex-1",
                    currentDecision === 'reject' && "ring-2 ring-red-500 ring-offset-2"
                  )}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Nicht akzeptieren
                </Button>
              </div>

              {/* Skip Button */}
              <Button
                onClick={handleSkip}
                variant="ghost"
                className="w-full"
                size="sm"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Überspringen (später entscheiden)
              </Button>
            </div>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              onClick={onPrevious}
              variant="outline"
              disabled={currentIndex === 0}
              size="lg"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Zurück
            </Button>

            {!isLastGap ? (
              <Button
                onClick={onNext}
                variant={currentDecision ? "default" : "outline"}
                disabled={!currentDecision}
                size="lg"
              >
                Weiter
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleCompleteClick}
                size="lg"
                className="font-semibold"
              >
                Bewertung abschließen
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Permanent Accept Dialog */}
      <AlertDialog open={showPermanentDialog} onOpenChange={setShowPermanentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dauerhaft akzeptieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Anforderung wird dauerhaft akzeptiert und bei zukünftigen Analysen automatisch als akzeptiert markiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Anforderung:</strong> {currentGap.customerText}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPermanentAccept}>
              <Star className="h-4 w-4 mr-2" />
              Dauerhaft akzeptieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Incomplete Review Dialog */}
      <AlertDialog open={showIncompleteDialog} onOpenChange={setShowIncompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nicht alle Fragen beantwortet</AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben noch nicht alle Fragen bewertet. 
              {Object.keys(decisions).length} von {gaps.length} Fragen wurden beantwortet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bewerten</AlertDialogCancel>
            <AlertDialogAction onClick={onComplete}>
              Trotzdem abschließen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GapReviewWizard;