import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface AcceptedRequirement {
  id: string;
  requirement_text: string;
  section: string;
  accepted_at: string;
  notes: string | null;
}

const AcceptedRequirements = () => {
  const [requirements, setRequirements] = useState<AcceptedRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from("accepted_requirements")
      .select("*")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false });

    if (error) {
      toast({
        title: "Fehler",
        description: "Akzeptierte Anforderungen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } else {
      setRequirements(data || []);
    }
    
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("accepted_requirements")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Die Anforderung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Gelöscht",
        description: "Die Anforderung wurde aus der Liste entfernt.",
      });
      setRequirements(requirements.filter(r => r.id !== deleteId));
    }
    
    setDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Card className="p-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Manuell akzeptierte Punkte</h2>
          <p className="text-muted-foreground">
            Diese Anforderungen haben Sie als dauerhaft akzeptiert markiert. Sie werden in zukünftigen Analysen automatisch als akzeptiert behandelt.
          </p>
        </div>
      </Card>

      {requirements.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-foreground mb-2">
                Keine dauerhaft akzeptierten Punkte
              </h4>
              <p className="text-muted-foreground">
                Sie haben noch keine Anforderungen als dauerhaft akzeptiert markiert. Diese erscheinen hier, wenn Sie in der Bewertung "Für die Zukunft immer akzeptieren" auswählen.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {requirements.map((req) => (
            <Card key={req.id} className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-xl font-semibold text-foreground">{req.section}</h4>
                      <Badge variant="secondary">Dauerhaft akzeptiert</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Akzeptiert am {new Date(req.accepted_at).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setDeleteId(req.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Anforderung</span>
                  </div>
                  <Card className="p-4 bg-muted/50">
                    <p className="text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap">
                      {req.requirement_text}
                    </p>
                  </Card>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anforderung entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diese Anforderung aus der Liste der dauerhaft akzeptierten Punkte entfernen möchten? 
              Sie wird in zukünftigen Analysen wieder als GAP angezeigt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AcceptedRequirements;
