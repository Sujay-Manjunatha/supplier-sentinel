import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, AlertTriangle, Info, ChevronLeft, ChevronRight, FileText } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Gap {
  section: string;
  customerText: string;
  baselineText: string;
  recommendation: string;
  severity: "KRITISCH" | "MITTEL" | "GERING";
  explanation: string;
}

interface GapReviewWizardProps {
  gaps: Gap[];
  currentIndex: number;
  decisions: Record<number, boolean>;
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
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [acceptPermanently, setAcceptPermanently] = useState(false);
  const { toast } = useToast();

  const hashText = (text: string): string => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  };

  const handleAcceptClick = () => {
    setShowAcceptDialog(true);
    setAcceptPermanently(false);
  };

  const handleConfirmAccept = async () => {
    if (acceptPermanently) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const requirementHash = hashText(currentGap.customerText);
        const { error } = await supabase
          .from("accepted_requirements")
          .insert({
            user_id: user.id,
            requirement_text: currentGap.customerText,
            requirement_hash: requirementHash,
            section: currentGap.section,
          });

        if (error) {
          toast({
            title: "Fehler",
            description: "Die Anforderung konnte nicht dauerhaft gespeichert werden.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Dauerhaft akzeptiert",
            description: "Diese Anforderung wird in zukünftigen Analysen automatisch akzeptiert.",
          });
        }
      }
    }
    
    setShowAcceptDialog(false);
    onAccept(currentIndex);
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
    switch (severity) {
      case "KRITISCH":
        return <Badge variant="destructive" className="text-base px-4 py-1">Kritisch</Badge>;
      case "MITTEL":
        return <Badge className="bg-warning text-warning-foreground text-base px-4 py-1">Mittel</Badge>;
      case "GERING":
        return <Badge variant="secondary" className="text-base px-4 py-1">Gering</Badge>;
      default:
        return <Badge className="text-base px-4 py-1">{severity}</Badge>;
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
                {getSeverityBadge(currentGap.severity)}
              </div>
              <p className="text-base text-muted-foreground leading-relaxed">{currentGap.explanation}</p>
            </div>
          </div>

          {/* Customer Text */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Kundenanforderung</span>
            </div>
            <Card className="p-5 bg-muted/50">
              <p className="text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap">
                {currentGap.customerText}
              </p>
            </Card>
          </div>

          {/* Recommendation */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">Empfehlung</p>
            <Card className="p-5 bg-success/5 border-success/20">
              <p className="text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere">
                {currentGap.recommendation}
              </p>
            </Card>
          </div>

          {/* Decision Buttons */}
          <div className="pt-6 flex gap-4">
            <Button
              onClick={handleAcceptClick}
              size="lg"
              variant={decisions[currentIndex] === true ? "default" : "outline"}
              className="flex-1 h-14 text-lg font-semibold"
            >
              ✓ Akzeptieren
            </Button>
            <Button
              onClick={() => onReject(currentIndex)}
              size="lg"
              variant={decisions[currentIndex] === false ? "destructive" : "outline"}
              className="flex-1 h-14 text-lg font-semibold"
            >
              ✗ Nicht akzeptieren
            </Button>
          </div>
        </div>
      </Card>

      {/* Accept Dialog */}
      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anforderung akzeptieren</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Möchten Sie diese Anforderung akzeptieren?</p>
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="permanent"
                  checked={acceptPermanently}
                  onCheckedChange={(checked) => setAcceptPermanently(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="permanent"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Für die Zukunft immer akzeptieren
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Diese Anforderung wird in zukünftigen Analysen automatisch als akzeptiert markiert.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAccept}>
              Akzeptieren
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
