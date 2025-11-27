import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface BaselineSetupProps {
  userId: string;
  onBaselineCreated: (id: string) => void;
  existingBaselineId: string | null;
  documentType: 'supplier_code' | 'nda';
}

const BaselineSetup = ({ userId, onBaselineCreated, existingBaselineId, documentType }: BaselineSetupProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingBaseline, setExistingBaseline] = useState<any>(null);
  const { toast } = useToast();

  const labels = {
    supplier_code: {
      title: "Mein Lieferantenkodex",
      description: "Laden Sie Ihren eigenen Lieferantenkodex hoch. Dieser dient als Referenz, um zu prüfen, welche Kundenanforderungen Sie bereits erfüllen.",
      saveButton: "Kodex speichern",
      updateButton: "Kodex aktualisieren",
    },
    nda: {
      title: "Mein NDA-Template",
      description: "Laden Sie Ihre Standard-Geheimhaltungsvereinbarung hoch. Diese dient als Referenz für den Vergleich mit Kunden-NDAs.",
      saveButton: "NDA speichern",
      updateButton: "NDA aktualisieren",
    }
  };

  useEffect(() => {
    fetchBaseline();
  }, [documentType]);

  const fetchBaseline = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("baseline_documents")
      .select("*")
      .eq("user_id", userId)
      .eq("document_type", documentType)
      .maybeSingle();

    if (data) {
      setExistingBaseline(data);
      setTitle(data.title);
      setContent(data.content);
      setFileName(data.file_name);
    } else {
      setExistingBaseline(null);
      setTitle("");
      setContent("");
      setFileName("");
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isTXT = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

    if (!isPDF && !isTXT) {
      toast({
        title: "Nicht unterstützter Dateityp",
        description: "Bitte laden Sie eine PDF- oder TXT-Datei hoch.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let text: string;

      if (isPDF) {
        text = await extract(file);
      } else {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (!text || text.trim().length === 0) {
        toast({
          title: "Leeres Dokument",
          description: "Die Datei scheint leer zu sein oder enthält keinen extrahierbaren Text.",
          variant: "destructive",
        });
        return;
      }

      setContent(text);
      setFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }

      toast({
        title: "Datei hochgeladen",
        description: isPDF ? "Text wurde erfolgreich aus PDF extrahiert." : "Textdatei erfolgreich geladen.",
      });
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload fehlgeschlagen",
        description: "Die Datei konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title || !content) {
      toast({
        title: "Fehler",
        description: "Bitte laden Sie ein Dokument hoch",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (existingBaseline) {
        const { error } = await supabase
          .from("baseline_documents")
          .update({
            title,
            content,
            file_name: fileName,
          })
          .eq("id", existingBaseline.id);

        if (error) throw error;

        toast({
          title: "Aktualisiert",
          description: "Dokument erfolgreich aktualisiert",
        });
        onBaselineCreated(existingBaseline.id);
      } else {
        const { data, error } = await supabase
          .from("baseline_documents")
          .insert({
            user_id: userId,
            title,
            content,
            file_name: fileName || "manual-entry.txt",
            document_type: documentType,
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Erfolg",
          description: "Dokument erfolgreich gespeichert",
        });
        onBaselineCreated(data.id);
        setExistingBaseline(data);
      }
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Dokument konnte nicht gespeichert werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingBaseline) return;

    if (!confirm("Möchten Sie dieses Dokument wirklich löschen?")) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("baseline_documents")
        .delete()
        .eq("id", existingBaseline.id);

      if (error) throw error;

      setExistingBaseline(null);
      setTitle("");
      setContent("");
      setFileName("");
      
      toast({
        title: "Gelöscht",
        description: "Dokument erfolgreich gelöscht",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Dokument konnte nicht gelöscht werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !fileName) {
    return <LoadingSpinner text="Lädt Dokument..." />;
  }

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{labels[documentType].title}</h2>
          <p className="text-muted-foreground">
            {labels[documentType].description}
          </p>
        </div>

        {existingBaseline ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
              <FileText className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{existingBaseline.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{existingBaseline.file_name}</p>
              </div>
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-primary/50 rounded-lg p-8 text-center hover:border-primary/70 transition-colors">
              <Upload className="h-12 w-12 mx-auto text-primary mb-4" />
              <p className="text-lg font-medium mb-2">Dokument hochladen</p>
              <p className="text-sm text-muted-foreground mb-4">PDF oder TXT (max. 20MB)</p>
              
              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="baseline-file">Datei auswählen</Label>
                  <Input
                    id="baseline-file"
                    type="file"
                    accept=".txt,.pdf"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </div>

                {fileName && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                      <FileText className="h-4 w-4" />
                      <span>{fileName}</span>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="baseline-title">Dokumenttitel</Label>
                      <Input
                        id="baseline-title"
                        placeholder="z.B. Unternehmens-Kodex v2.0"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>

                    <Button onClick={handleSave} disabled={loading} className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      {labels[documentType].saveButton}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BaselineSetup;
