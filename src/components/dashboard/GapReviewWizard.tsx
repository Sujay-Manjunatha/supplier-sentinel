import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, AlertTriangle, Info, ChevronLeft, ChevronRight, FileText, CheckCircle2, XCircle, Lightbulb, Star } from "lucide-react";
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

interface Gap {
  section: string;
  customerText: string;
  severity: 'KRITISCH' | 'MITTEL' | 'GERING';
  aiRecommendation: 'AKZEPTIEREN' | 'ABLEHNEN' | 'PRÜFEN';
  reasoning: string;
  risksIfAccepted: string;
  risksIfRejected: string;
}

interface GapReviewWizardProps {
  gaps: Gap[];
  currentIndex: number;
  decisions: Record<number, 'accept' | 'reject'>;
  onAccept: (index: number) => void;
  onReject: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
}

const GapReviewWizard = ({
  gaps,
  currentIndex,
  decisions,
  onAccept,
  onReject,
  onPrevious,
  onNext,
  onComplete,
}: GapReviewWizardProps) => {
  const currentGap = gaps[currentIndex];
  const isLastGap = currentIndex === gaps.length - 1;
  const allDecisionsMade = gaps.every((_, index) => decisions[index] !== undefined);
  const progress = ((currentIndex + 1) / gaps.length) * 100;
  const [showPermanentDialog, setShowPermanentDialog] = useState(false);

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

    const { error } = await supabase
      .from('accepted_requirements')
      .insert({
        user_id: user.id,
        section: currentGap.section,
        requirement_text: currentGap.customerText,
        requirement_hash: hash,
        notes: 'Dauerhaft akzeptiert'
      });

    if (error) {
      console.error('Error saving permanent acceptance:', error);
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Dauerhaft akzeptiert und gespeichert");
    }
    
    onAccept(currentIndex);
    setShowPermanentDialog(false);
  };

  const handleReject = () => {
    onReject(currentIndex);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "KRITISCH":
        return <AlertCircle className="h-6 w-6 text-destructive" />;
      case "MITTEL":
        return <AlertTriangle className="h-6 w-6 text-warning" />;
      case "GERING":
        return <Info className="h-6 w-6 text-primary" />;
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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

      {/* Current Gap Card */}
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

            {currentGap.risksIfRejected && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Risiken bei Ablehnung
                </h3>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {currentGap.risksIfRejected}
                </p>
              </div>
            )}
          </div>

          {/* Decision Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleAccept}
              className="flex-1"
              variant="outline"
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
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Nicht akzeptieren
            </Button>
          </div>
        </div>
      </Card>

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
            variant="outline"
            size="lg"
          >
            Weiter
            <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={onComplete}
            disabled={!allDecisionsMade}
            size="lg"
            className="font-semibold"
          >
            Bewertung abschließen
          </Button>
        )}
      </div>
    </div>
  );
};

export default GapReviewWizard;
