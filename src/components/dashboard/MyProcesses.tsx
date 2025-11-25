import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CompletedEvaluation {
  id: string;
  title: string;
  customer_name: string;
  overall_compliance: number;
  critical_gaps: number;
  medium_gaps: number;
  low_gaps: number;
  completed_at: string;
  email_template: string | null;
  gaps: any[];
  decisions: Record<string, string>;
}

export default function MyProcesses() {
  const [evaluations, setEvaluations] = useState<CompletedEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<CompletedEvaluation | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("completed_evaluations")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (error) throw error;
      setEvaluations((data as any) || []);
    } catch (error) {
      console.error("Error loading evaluations:", error);
      toast({
        title: "Fehler",
        description: "Vorgänge konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("completed_evaluations")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setEvaluations(evaluations.filter((e) => e.id !== deleteId));
      toast({
        title: "Gelöscht",
        description: "Vorgang wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      console.error("Error deleting evaluation:", error);
      toast({
        title: "Fehler",
        description: "Vorgang konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const copyEmailTemplate = () => {
    if (selectedEvaluation?.email_template) {
      navigator.clipboard.writeText(selectedEvaluation.email_template);
      toast({
        title: "Kopiert",
        description: "Email-Vorlage wurde in die Zwischenablage kopiert.",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Noch keine abgeschlossenen Vorgänge vorhanden.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Beginnen Sie einen neuen Vorgang, um Lieferantenkodizes zu bewerten.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Meine Vorgänge</h2>
        <Badge variant="secondary">{evaluations.length} Vorgänge</Badge>
      </div>

      {evaluations.map((evaluation) => (
        <Card key={evaluation.id} className="hover:bg-muted/50 transition-colors">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{evaluation.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(evaluation.completed_at).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(evaluation.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{evaluation.overall_compliance}%</p>
                  <p className="text-xs text-muted-foreground">Compliance</p>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{evaluation.critical_gaps}</p>
                <p className="text-xs text-muted-foreground">Kritisch</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{evaluation.medium_gaps}</p>
                <p className="text-xs text-muted-foreground">Mittel</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-500">{evaluation.low_gaps}</p>
                <p className="text-xs text-muted-foreground">Gering</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedEvaluation(evaluation);
                  setShowEmailDialog(true);
                }}
                disabled={!evaluation.email_template}
              >
                <FileText className="h-4 w-4 mr-2" />
                Email-Vorlage anzeigen
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorgang löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Der Vorgang und alle zugehörigen Daten werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Template Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Email-Vorlage</DialogTitle>
            <DialogDescription>
              {selectedEvaluation?.title}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={selectedEvaluation?.email_template || ""}
            readOnly
            className="min-h-[400px] font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Schließen
            </Button>
            <Button onClick={copyEmailTemplate}>
              In Zwischenablage kopieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}