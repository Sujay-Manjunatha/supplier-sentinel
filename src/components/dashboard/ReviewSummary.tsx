import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, Info, CheckCircle, FileText } from "lucide-react";

interface Gap {
  section: string;
  customerText: string;
  baselineText: string;
  recommendation: string;
  severity: "KRITISCH" | "MITTEL" | "GERING";
  explanation: string;
}

interface ReviewSummaryProps {
  gaps: Gap[];
  decisions: Record<number, boolean>;
  overallCompliance: number;
  onRestart: () => void;
}

const ReviewSummary = ({
  gaps,
  decisions,
  overallCompliance,
  onRestart,
}: ReviewSummaryProps) => {
  const rejectedGaps = gaps.filter((_, index) => decisions[index] === false);
  const acceptedCount = gaps.filter((_, index) => decisions[index] === true).length;
  const rejectedCount = rejectedGaps.length;

  const criticalRejected = rejectedGaps.filter((gap) => gap.severity === "KRITISCH").length;
  const mediumRejected = rejectedGaps.filter((gap) => gap.severity === "MITTEL").length;
  const lowRejected = rejectedGaps.filter((gap) => gap.severity === "GERING").length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "KRITISCH":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "MITTEL":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "GERING":
        return <Info className="h-5 w-5 text-primary" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "KRITISCH":
        return <Badge variant="destructive">Kritisch</Badge>;
      case "MITTEL":
        return <Badge className="bg-warning text-warning-foreground">Mittel</Badge>;
      case "GERING":
        return <Badge variant="secondary">Gering</Badge>;
      default:
        return <Badge>{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Summary Header */}
      <Card className="p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-success" />
            <h2 className="text-3xl font-bold text-foreground">Bewertung abgeschlossen</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 bg-success/5 border-success/20">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Gesamtübereinstimmung</p>
                <p className="text-4xl font-bold text-success">{overallCompliance}%</p>
              </div>
            </Card>

            <Card className="p-6 bg-primary/5 border-primary/20">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Akzeptiert</p>
                <p className="text-4xl font-bold text-primary">{acceptedCount}</p>
              </div>
            </Card>

            <Card className="p-6 bg-destructive/5 border-destructive/20">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Nicht akzeptiert</p>
                <p className="text-4xl font-bold text-destructive">{rejectedCount}</p>
              </div>
            </Card>
          </div>

          {rejectedCount > 0 && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <Card className="p-4 border-destructive/20 bg-destructive/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-xs font-medium text-muted-foreground">Kritisch</p>
                  </div>
                  <p className="text-2xl font-bold text-destructive">{criticalRejected}</p>
                </div>
              </Card>

              <Card className="p-4 border-warning/20 bg-warning/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <p className="text-xs font-medium text-muted-foreground">Mittel</p>
                  </div>
                  <p className="text-2xl font-bold text-warning">{mediumRejected}</p>
                </div>
              </Card>

              <Card className="p-4 border-primary/20 bg-primary/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Gering</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">{lowRejected}</p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </Card>

      {/* Rejected Gaps List */}
      {rejectedCount > 0 ? (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-foreground">
            Nicht akzeptierte Punkte ({rejectedCount})
          </h3>
          <p className="text-muted-foreground">
            Diese Punkte erfordern Aufmerksamkeit und sollten mit dem Lieferanten besprochen werden.
          </p>

          {rejectedGaps.map((gap, index) => (
            <Card key={index} className="p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  {getSeverityIcon(gap.severity)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-xl font-semibold text-foreground">{gap.section}</h4>
                      {getSeverityBadge(gap.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{gap.explanation}</p>
                  </div>
                </div>

                <div className="pl-10 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>Kundentext</span>
                    </div>
                    <Card className="p-4 bg-muted/50">
                      <p className="text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap">
                        {gap.customerText}
                      </p>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>Baseline-Referenz</span>
                    </div>
                    <Card className="p-4 bg-primary/5 border-primary/20">
                      <p className="text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap">
                        {gap.baselineText}
                      </p>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Empfehlung</p>
                    <Card className="p-4 bg-destructive/5 border-destructive/20">
                      <p className="text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere">
                        {gap.recommendation}
                      </p>
                    </Card>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-foreground mb-2">Alle Punkte akzeptiert</h4>
              <p className="text-muted-foreground">
                Sie haben alle identifizierten Abweichungen als akzeptabel eingestuft.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center pt-4">
        <Button onClick={onRestart} size="lg" variant="outline">
          Bewertung erneut durchführen
        </Button>
      </div>
    </div>
  );
};

export default ReviewSummary;
