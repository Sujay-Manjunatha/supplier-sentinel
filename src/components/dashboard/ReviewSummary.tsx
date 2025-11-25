import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, Mail, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Gap {
  section: string;
  customerText: string;
  gapType: 'ZUSÄTZLICH' | 'STRENGER' | 'WIDERSPRUCH';
  severity: 'KRITISCH' | 'MITTEL' | 'GERING';
  aiRecommendation: 'AKZEPTIEREN' | 'ABLEHNEN' | 'PRÜFEN';
  ownCodexCoverage: string;
  reasoning: string;
  risksIfAccepted: string;
}

interface ReviewSummaryProps {
  gaps: Gap[];
  decisions: Record<number, 'accept' | 'reject'>;
  overallCompliance: number;
  analysisId: string | null;
  comparisonDocumentId: string | null;
  onRestart: () => void;
}

export const ReviewSummary = ({ gaps, decisions, overallCompliance, analysisId, comparisonDocumentId, onRestart }: ReviewSummaryProps) => {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const acceptedCount = Object.values(decisions).filter(d => d === 'accept').length;
  const rejectedCount = Object.values(decisions).filter(d => d === 'reject').length;

  const rejectedGaps = gaps.filter((_, index) => decisions[index] === 'reject');

  const generateEmailTemplate = async () => {
    setIsGenerating(true);
    try {
      const rejectedData = rejectedGaps.map(gap => ({
        section: gap.section,
        customerText: gap.customerText,
        reasoning: gap.reasoning,
        severity: gap.severity
      }));

      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: { rejectedGaps: rejectedData }
      });

      if (error) throw error;

      setEmailTemplate(data.emailTemplate);
      setShowEmailDialog(true);
      toast.success("Email-Vorlage erstellt");
    } catch (error) {
      console.error('Error generating email:', error);
      toast.error("Fehler beim Erstellen der Email-Vorlage");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailTemplate);
    toast.success("In Zwischenablage kopiert");
  };

  const saveEvaluation = async () => {
    if (!analysisId || !comparisonDocumentId) {
      toast.error("Fehlende Analyse-Daten");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Nicht authentifiziert");
        return;
      }

      // Get comparison document to extract customer name
      const { data: compDoc } = await supabase
        .from("comparison_documents")
        .select("content, title")
        .eq("id", comparisonDocumentId)
        .single();

      let customerName = "Unbekanntes Unternehmen";
      let title = "Lieferantenkodex";

      if (compDoc) {
        // Try to extract company name using edge function
        const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-company-name', {
          body: { documentContent: compDoc.content }
        });

        if (!extractError && extractData?.companyName) {
          customerName = extractData.companyName;
        }

        title = `${customerName}-Lieferantenkodex`;
      }

      const criticalGaps = rejectedGaps.filter(g => g.severity === 'KRITISCH').length;
      const mediumGaps = rejectedGaps.filter(g => g.severity === 'MITTEL').length;
      const lowGaps = rejectedGaps.filter(g => g.severity === 'GERING').length;

      const { error } = await supabase
        .from("completed_evaluations")
        .insert({
          user_id: user.id,
          comparison_document_id: comparisonDocumentId,
          customer_name: customerName,
          title: title,
          gaps: gaps as any,
          decisions: decisions as any,
          email_template: emailTemplate || null,
          overall_compliance: overallCompliance,
          critical_gaps: criticalGaps,
          medium_gaps: mediumGaps,
          low_gaps: lowGaps,
        });

      if (error) throw error;

      setIsSaved(true);
      toast.success("Bewertung erfolgreich gespeichert!");
    } catch (error) {
      console.error('Error saving evaluation:', error);
      toast.error("Fehler beim Speichern der Bewertung");
    } finally {
      setIsSaving(false);
    }
  };

  const criticalRejected = rejectedGaps.filter(g => g.severity === 'KRITISCH').length;
  const mediumRejected = rejectedGaps.filter(g => g.severity === 'MITTEL').length;
  const lowRejected = rejectedGaps.filter(g => g.severity === 'GERING').length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'KRITISCH':
        return <AlertTriangle className="h-4 w-4" />;
      case 'MITTEL':
        return <AlertTriangle className="h-4 w-4" />;
      case 'GERING':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null;
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

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6" />
          Bewertungszusammenfassung
        </CardTitle>
        <CardDescription>
          Übersicht über Ihre Entscheidungen zur Gap-Analyse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">{acceptedCount}</div>
            <div className="text-sm text-muted-foreground">Akzeptiert</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-destructive">{rejectedCount}</div>
            <div className="text-sm text-muted-foreground">Nicht akzeptiert</div>
          </div>
        </div>

        {rejectedCount > 0 && (
          <>
            <Separator />
            
            {/* Rejected by Severity */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <div className="text-xl font-bold text-destructive">{criticalRejected}</div>
                <div className="text-xs text-muted-foreground">Kritisch</div>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <div className="text-xl font-bold text-primary">{mediumRejected}</div>
                <div className="text-xs text-muted-foreground">Mittel</div>
              </div>
              <div className="text-center p-3 bg-secondary/10 rounded-lg">
                <div className="text-xl font-bold text-secondary-foreground">{lowRejected}</div>
                <div className="text-xs text-muted-foreground">Gering</div>
              </div>
            </div>

            <Separator />

            {/* Rejected Gaps Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Nicht akzeptierte Punkte</h3>
              
              <div className="space-y-4">
                {rejectedGaps.map((gap, index) => (
                  <div key={index} className="border-l-4 border-destructive pl-4 py-2">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-sm">{gap.section}</h4>
                        <Badge variant={getSeverityBadge(gap.severity)} className="mt-1">
                          {getSeverityIcon(gap.severity)}
                          <span className="ml-1">{gap.severity}</span>
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2 mt-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Kundenanforderung:</p>
                        <p className="text-sm">{gap.customerText}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Grund der Ablehnung:</p>
                        <p className="text-sm">{gap.reasoning}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button 
                  onClick={generateEmailTemplate} 
                  variant="default" 
                  className="flex-1"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generiere...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Email-Vorlage erstellen
                    </>
                  )}
                </Button>
                <Button onClick={onRestart} variant="outline" className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Neu bewerten
                </Button>
              </div>

              <Button 
                onClick={saveEvaluation} 
                variant="secondary" 
                className="w-full"
                disabled={isSaving || isSaved}
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichere...
                  </>
                ) : isSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    ✓ Bewertung gespeichert
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Bewertung abschließen und speichern
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {rejectedCount === 0 && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Alle Punkte akzeptiert!</h3>
            <p className="text-muted-foreground mb-6">
              Sie haben alle identifizierten Gaps als akzeptabel bewertet.
            </p>
            <Button onClick={onRestart} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Neue Analyse starten
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email-Vorlage für abgelehnte Punkte</DialogTitle>
            <DialogDescription>
              Diese Vorlage können Sie in Ihr Email-Programm kopieren und an Ihren Kunden senden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={copyToClipboard} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                In Zwischenablage kopieren
              </Button>
              <Button onClick={() => setShowEmailDialog(false)} variant="outline" className="flex-1">
                Schließen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
