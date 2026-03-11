import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ChevronRight, Lock, Mail, Eye, CheckCircle2 } from "lucide-react";
import type { CautionItem } from "@/lib/gemini";

interface Gap {
  section: string;
  customerText: string;
  severity: "KRITISCH" | "MITTEL" | "GERING";
  reasoning: string;
  aiRecommendation: string;
  ownCodexCoverage: string;
  risksIfAccepted: string;
  gapType: 'negative_match';
  matchedNegativePoint?: { title: string; description: string };
  matchConfidence?: 'HOCH' | 'MITTEL' | 'NIEDRIG';
}

export interface PointComment {
  internal: string;
  external: string;
}

export type CommentsMap = Record<string, PointComment>;

interface RejectedPointsCommentReviewProps {
  rejectedGaps: Gap[];
  rejectedCautionItems: CautionItem[];
  onComplete: (comments: CommentsMap) => void;
}

const SEVERITY_VARIANT: Record<string, "destructive" | "default" | "secondary"> = {
  KRITISCH: "destructive",
  MITTEL: "default",
  GERING: "secondary",
};

export const RejectedPointsCommentReview = ({
  rejectedGaps,
  rejectedCautionItems,
  onComplete,
}: RejectedPointsCommentReviewProps) => {
  const [comments, setComments] = useState<CommentsMap>({});

  const update = (key: string, field: "internal" | "external", value: string) => {
    setComments((prev) => ({
      ...prev,
      [key]: {
        internal: prev[key]?.internal ?? "",
        external: prev[key]?.external ?? "",
        [field]: value,
      },
    }));
  };

  const hasAnyRejected = rejectedGaps.length > 0 || rejectedCautionItems.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 px-4 py-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Review Rejected Points</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Optionally add notes to each rejected point. External comments will appear in the supplier email beneath the relevant line.
        </p>
      </div>

      {!hasAnyRejected && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
          <p className="text-muted-foreground">No rejected points — nothing to annotate.</p>
        </Card>
      )}

      {/* Rejected NL Gaps */}
      {rejectedGaps.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-base text-muted-foreground uppercase tracking-wide">
            Rejected Requirements ({rejectedGaps.length})
          </h3>
          {rejectedGaps.map((gap, index) => {
            const key = `gap-${index}`;
            const comment = comments[key] ?? { internal: "", external: "" };
            return (
              <Card key={key} className="overflow-hidden">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
                  {/* Left: point details */}
                  <div className="flex-1 p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={SEVERITY_VARIANT[gap.severity]}>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {gap.severity}
                      </Badge>
                      <span className="text-sm font-semibold">{gap.section}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{gap.customerText}</p>
                    <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                      {gap.reasoning}
                    </p>
                  </div>

                  {/* Right: comment fields */}
                  <div className="md:w-72 lg:w-80 p-4 space-y-3 bg-muted/20 flex-shrink-0">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Internal Note
                      </Label>
                      <Textarea
                        placeholder="Internal notes (not shared with supplier)…"
                        value={comment.internal}
                        onChange={(e) => update(key, "internal", e.target.value)}
                        className="text-sm resize-none bg-background min-h-[68px]"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                        <Mail className="h-3 w-3" />
                        External Comment
                        <span className="text-[10px] text-muted-foreground font-normal ml-1">(in email)</span>
                      </Label>
                      <Textarea
                        placeholder="Comment for supplier email…"
                        value={comment.external}
                        onChange={(e) => update(key, "external", e.target.value)}
                        className="text-sm resize-none border-blue-200 focus-visible:ring-blue-400 bg-blue-50/40 dark:bg-blue-950/20 min-h-[68px]"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rejected Caution Items */}
      {rejectedCautionItems.length > 0 && (
        <>
          {rejectedGaps.length > 0 && <Separator />}
          <div className="space-y-3">
            <h3 className="font-semibold text-base text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-500" />
              Rejected Points to Watch ({rejectedCautionItems.length})
            </h3>
            {rejectedCautionItems.map((item, index) => {
              const key = `caution-${index}`;
              const comment = comments[key] ?? { internal: "", external: "" };
              return (
                <Card key={key} className="overflow-hidden border-amber-200 dark:border-amber-800">
                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
                    {/* Left: item details */}
                    <div className="flex-1 p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
                          {item.section}
                        </Badge>
                        <span className="text-sm font-semibold">{item.topic}</span>
                      </div>
                      <p className="text-xs italic text-muted-foreground border-l-2 border-amber-300 pl-2">
                        "{item.excerpt}"
                      </p>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                    </div>

                    {/* Right: comment fields */}
                    <div className="md:w-72 lg:w-80 p-4 space-y-3 bg-amber-50/30 dark:bg-amber-950/10 flex-shrink-0">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Internal Note
                        </Label>
                        <Textarea
                          placeholder="Internal notes (not shared with supplier)…"
                          value={comment.internal}
                          onChange={(e) => update(key, "internal", e.target.value)}
                          className="text-sm resize-none bg-background min-h-[68px]"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                          <Mail className="h-3 w-3" />
                          External Comment
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">(in email)</span>
                        </Label>
                        <Textarea
                          placeholder="Comment for supplier email…"
                          value={comment.external}
                          onChange={(e) => update(key, "external", e.target.value)}
                          className="text-sm resize-none border-blue-200 focus-visible:ring-blue-400 bg-blue-50/40 dark:bg-blue-950/20 min-h-[68px]"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="pt-2 pb-4 space-y-2">
        <Button onClick={() => onComplete(comments)} size="lg" className="w-full font-semibold">
          Continue to Summary
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Comments are optional — you can continue without adding any.
        </p>
      </div>
    </div>
  );
};
