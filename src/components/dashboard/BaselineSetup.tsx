import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";

interface BaselineSetupProps {
  userId: string;
  onBaselineCreated: (id: string) => void;
  existingBaselineId: string | null;
}

const BaselineSetup = ({ userId, onBaselineCreated, existingBaselineId }: BaselineSetupProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingBaseline, setExistingBaseline] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (existingBaselineId) {
      fetchBaseline();
    }
  }, [existingBaselineId]);

  const fetchBaseline = async () => {
    const { data, error } = await supabase
      .from("baseline_documents")
      .select("*")
      .eq("id", existingBaselineId)
      .single();

    if (data) {
      setExistingBaseline(data);
      setTitle(data.title);
      setContent(data.content);
      setFileName(data.file_name);
    }
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
        // Extract text from PDF
        text = await extract(file);
      } else {
        // Read text file
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
        description: "Bitte geben Sie sowohl Titel als auch Inhalt an",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (existingBaseline) {
        // Update existing
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
          description: "Lieferantenkodex erfolgreich aktualisiert",
        });
        onBaselineCreated(existingBaseline.id);
      } else {
        // Create new
        const { data, error } = await supabase
          .from("baseline_documents")
          .insert({
            user_id: userId,
            title,
            content,
            file_name: fileName || "manual-entry.txt",
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Erfolg",
          description: "Lieferantenkodex erfolgreich gespeichert",
        });
        onBaselineCreated(data.id);
      }
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Lieferantenkodex konnte nicht gespeichert werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingBaseline) return;

    if (!confirm("Möchten Sie diesen Lieferantenkodex wirklich löschen?")) return;

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
        description: "Lieferantenkodex erfolgreich gelöscht",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Lieferantenkodex konnte nicht gelöscht werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Mein Lieferantenkodex</h2>
          <p className="text-muted-foreground">
            Laden Sie Ihren eigenen Lieferantenkodex hoch. Dieser dient als Referenz, um zu prüfen, welche Kundenanforderungen Sie bereits erfüllen.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseline-file">Dokument hochladen (Optional)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="baseline-file"
                type="file"
                accept=".txt,.pdf"
                onChange={handleFileUpload}
                disabled={loading}
                className="flex-1"
              />
              {fileName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{fileName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseline-title">Dokumenttitel</Label>
            <Input
              id="baseline-title"
              placeholder="z.B. Unternehmen Lieferantenkodex v2.0"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseline-content">Inhalt</Label>
            <Textarea
              id="baseline-content"
              placeholder="Fügen Sie den Inhalt Ihres Lieferantenkodex hier ein..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              {existingBaseline ? "Kodex aktualisieren" : "Kodex speichern"}
            </Button>
            {existingBaseline && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default BaselineSetup;
