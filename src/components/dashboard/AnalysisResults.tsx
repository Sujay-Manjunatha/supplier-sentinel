import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, AlertTriangle, Info, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface Gap {
  section: string;
  customerText: string;
  baselineText: string;
  recommendation: string;
  severity: "critical" | "medium" | "low";
  explanation: string;
}

interface AnalysisResultsProps {
  analysisId: string | null;
}

const AnalysisResults = ({ analysisId }: AnalysisResultsProps) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error("Error fetching analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 max-w-4xl mx-auto">
        <p className="text-center text-muted-foreground">Loading analysis...</p>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="p-6 max-w-4xl mx-auto">
        <p className="text-center text-muted-foreground">No analysis selected</p>
      </Card>
    );
  }

  const gaps: Gap[] = analysis.gaps || [];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "medium":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "low":
        return <Info className="h-5 w-5 text-primary" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "medium":
        return <Badge className="bg-warning text-warning-foreground">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge>{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Overview Card */}
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">GAP Analysis Report</h2>
            <p className="text-muted-foreground">
              Comprehensive comparison of supplier codes with AI-powered insights
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Overall Compliance</span>
                  <span className="text-2xl font-bold text-primary">
                    {analysis.overall_compliance_percentage}%
                  </span>
                </div>
                <Progress value={analysis.overall_compliance_percentage} className="h-3" />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Total Gaps Identified</p>
                <p className="text-3xl font-bold text-foreground">{analysis.total_gaps}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 border-destructive/20 bg-destructive/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-xs font-medium text-muted-foreground">Critical</p>
                  </div>
                  <p className="text-2xl font-bold text-destructive">{analysis.critical_gaps}</p>
                </div>
              </Card>

              <Card className="p-4 border-warning/20 bg-warning/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <p className="text-xs font-medium text-muted-foreground">Medium</p>
                  </div>
                  <p className="text-2xl font-bold text-warning">{analysis.medium_gaps}</p>
                </div>
              </Card>

              <Card className="p-4 border-primary/20 bg-primary/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Low</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">{analysis.low_gaps}</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Card>

      {/* Gaps List */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-foreground">Detailed Gap Analysis</h3>
        {gaps.map((gap, index) => (
          <Collapsible key={index}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full p-6 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4 w-full">
                    {getSeverityIcon(gap.severity)}
                    <div className="flex-1 text-left space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-foreground text-lg">{gap.section}</h4>
                        {getSeverityBadge(gap.severity)}
                      </div>
                      <p className="text-sm text-muted-foreground">{gap.explanation}</p>
                    </div>
                  </div>
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-6 pb-6 space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>Customer Document</span>
                    </div>
                    <Card className="p-4 bg-muted/50">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{gap.customerText}</p>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>Baseline Reference</span>
                    </div>
                    <Card className="p-4 bg-primary/5 border-primary/20">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{gap.baselineText}</p>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Recommendation</p>
                    <Card className="p-4 bg-success/5 border-success/20">
                      <p className="text-sm text-foreground">{gap.recommendation}</p>
                    </Card>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}

        {gaps.length === 0 && (
          <Card className="p-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <Info className="h-8 w-8 text-success" />
              </div>
              <div>
                <h4 className="text-xl font-semibold text-foreground mb-2">No Gaps Identified</h4>
                <p className="text-muted-foreground">
                  The customer's supplier code appears to be fully compliant with your baseline requirements.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AnalysisResults;
