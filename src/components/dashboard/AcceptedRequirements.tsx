import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface AcceptedRequirement {
  id: string;
  requirement_text: string;
  section: string;
  accepted_at: string;
  notes: string | null;
  category: string;
}

interface AcceptedRequirementsProps {
  documentType: 'supplier_code' | 'nda';
}

const AcceptedRequirements = ({ documentType }: AcceptedRequirementsProps) => {
  const [requirements, setRequirements] = useState<AcceptedRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadRequirements();
  }, [documentType]);

  const loadRequirements = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from("accepted_requirements")
      .select("*")
      .eq("user_id", user.id)
      .eq("document_type", documentType)
      .order("category", { ascending: true })
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

  const inferCategory = (section: string, text: string): string => {
    const lower = `${section} ${text}`.toLowerCase();
    
    if (documentType === 'nda') {
      // NDA-spezifische Kategorien
      if (lower.includes('geheimhaltung') || lower.includes('vertraulich') || lower.includes('confidential')) 
        return 'Geheimhaltungspflichten';
      if (lower.includes('laufzeit') || lower.includes('dauer') || lower.includes('kündigung')) 
        return 'Laufzeit & Kündigung';
      if (lower.includes('rückgabe') || lower.includes('vernichtung') || lower.includes('löschung')) 
        return 'Rückgabe & Vernichtung';
      if (lower.includes('weitergabe') || lower.includes('offenlegung') || lower.includes('disclosure')) 
        return 'Weitergabe & Offenlegung';
      if (lower.includes('sanktion') || lower.includes('vertragsstrafe') || lower.includes('haftung')) 
        return 'Sanktionen & Haftung';
      if (lower.includes('ausnahme') || lower.includes('ausgenommen')) 
        return 'Ausnahmen';
      return 'Allgemeine Bestimmungen';
    } else {
      // Lieferantenkodex-Kategorien
      if (lower.includes('arbeit') || lower.includes('beschäft') || lower.includes('arbeitszeit')) 
        return 'Arbeitsbedingungen';
      if (lower.includes('mensch') || lower.includes('kinderarbeit') || lower.includes('zwangsarbeit')) 
        return 'Menschenrechte';
      if (lower.includes('umwelt') || lower.includes('emission') || lower.includes('ressource') || lower.includes('nachhaltig')) 
        return 'Umweltschutz';
      if (lower.includes('korruption') || lower.includes('bestechung') || lower.includes('interessenkonflikt')) 
        return 'Anti-Korruption';
      if (lower.includes('gesundheit') || lower.includes('sicherheit') || lower.includes('arbeitsschutz')) 
        return 'Gesundheit & Sicherheit';
      if (lower.includes('daten') || lower.includes('information') || lower.includes('geistiges eigentum')) 
        return 'Datenschutz & IP';
      if (lower.includes('lieferkette') || lower.includes('subunternehmer') || lower.includes('unterlieferant')) 
        return 'Lieferkette';
      if (lower.includes('audit') || lower.includes('prüf') || lower.includes('dokumentation') || lower.includes('bericht')) 
        return 'Compliance & Monitoring';
      return 'Allgemein';
    }
  };

  const groupByCategory = () => {
    const grouped: Record<string, AcceptedRequirement[]> = {};
    requirements.forEach((req) => {
      // Try to infer better category if it's "Allgemein"
      let category = req.category;
      if (!category || category === 'Allgemein') {
        category = inferCategory(req.section, req.requirement_text);
      }
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(req);
    });
    return grouped;
  };

  if (loading) {
    return <LoadingSpinner text="Lade akzeptierte Punkte..." />;
  }

  const groupedRequirements = groupByCategory();
  const categories = Object.keys(groupedRequirements).sort();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Card className="p-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Dauerhaft akzeptierte Punkte</h2>
          <p className="text-muted-foreground">
            Diese Anforderungen haben Sie als dauerhaft akzeptiert markiert. Sie werden in zukünftigen Analysen automatisch als akzeptiert behandelt.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Badge variant="secondary">{requirements.length} Anforderungen</Badge>
            <Badge variant="outline">{categories.length} Kategorien</Badge>
          </div>
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
                Sie haben noch keine Anforderungen als dauerhaft akzeptiert markiert. Diese erscheinen hier, wenn Sie in der Bewertung "Dauerhaft akzeptieren" auswählen.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {categories.map((category) => (
            <AccordionItem key={category} value={category} className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{category}</h3>
                      <Badge variant="secondary">
                        {groupedRequirements[category].length}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0 space-y-3">
                    {groupedRequirements[category].map((req) => (
                      <Card key={req.id} className="p-4 bg-muted/30">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <h4 className="font-medium text-sm">{req.section}</h4>
                              <p className="text-xs text-muted-foreground">
                                Akzeptiert am {new Date(req.accepted_at).toLocaleDateString("de-DE", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(req.id)}
                              className="text-destructive hover:text-destructive h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="text-sm text-foreground bg-background p-3 rounded-md border">
                            {req.requirement_text}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
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
