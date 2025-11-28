import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Trash2, Edit2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface NegativeListItem {
  id: string;
  title: string;
  description: string;
  category: string;
  created_at: string;
}

interface NegativeListManagerProps {
  documentType: 'supplier_code' | 'nda';
}

const CATEGORIES_SUPPLIER = [
  'Arbeitsbedingungen',
  'Arbeitszeit',
  'Vergütung',
  'Gesundheit und Sicherheit',
  'Umweltschutz',
  'Ethik und Compliance',
  'Haftung',
  'Kündigung',
  'Sonstiges'
];

const CATEGORIES_NDA = [
  'Geheimhaltungspflicht',
  'Vertrauliche Informationen',
  'Nutzungsbeschränkungen',
  'Weitergabeverbot',
  'Aufbewahrung und Löschung',
  'Laufzeit',
  'Vertragsstrafe',
  'Haftung',
  'Rückgabepflicht',
  'Sonstiges'
];

const NegativeListManager = ({ documentType }: NegativeListManagerProps) => {
  const [items, setItems] = useState<NegativeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', category: 'Sonstiges' });
  const { toast } = useToast();

  const categories = documentType === 'supplier_code' ? CATEGORIES_SUPPLIER : CATEGORIES_NDA;

  useEffect(() => {
    fetchItems();
  }, [documentType]);

  const fetchItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('negative_list_items')
        .select('*')
        .eq('document_type', documentType)
        .order('category', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        title: "Fehler",
        description: "Negativliste konnte nicht geladen werden",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      let content = '';

      if (file.type === 'application/pdf') {
        content = await extract(file);
      } else if (file.type === 'text/plain') {
        content = await file.text();
      } else {
        throw new Error('Nur PDF oder TXT Dateien werden unterstützt');
      }

      const { data: extractedData, error: extractError } = await supabase.functions.invoke(
        'extract-negative-points',
        { body: { content, documentType } }
      );

      if (extractError) throw extractError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const pointsToInsert = extractedData.points.map((point: any) => ({
        user_id: user.id,
        document_type: documentType,
        title: point.title,
        description: point.description,
        category: point.category
      }));

      const { error: insertError } = await supabase
        .from('negative_list_items')
        .insert(pointsToInsert);

      if (insertError) throw insertError;

      toast({
        title: "Erfolg",
        description: `${extractedData.points.length} Punkte erfolgreich importiert`
      });

      fetchItems();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Fehler",
        description: error.message || "Datei konnte nicht verarbeitet werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleAdd = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: "Fehler",
        description: "Titel und Beschreibung sind erforderlich",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const { error } = await supabase
        .from('negative_list_items')
        .insert({
          user_id: user.id,
          document_type: documentType,
          title: formData.title,
          description: formData.description,
          category: formData.category
        });

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Punkt erfolgreich hinzugefügt"
      });

      setFormData({ title: '', description: '', category: 'Sonstiges' });
      setShowAddForm(false);
      fetchItems();
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast({
        title: "Fehler",
        description: "Punkt konnte nicht hinzugefügt werden",
        variant: "destructive"
      });
    }
  };

  const handleUpdate = async (id: string, updates: Partial<NegativeListItem>) => {
    try {
      const { error } = await supabase
        .from('negative_list_items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Punkt erfolgreich aktualisiert"
      });

      setEditingId(null);
      fetchItems();
    } catch (error: any) {
      console.error('Error updating item:', error);
      toast({
        title: "Fehler",
        description: "Punkt konnte nicht aktualisiert werden",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Punkt wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('negative_list_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Punkt erfolgreich gelöscht"
      });

      fetchItems();
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast({
        title: "Fehler",
        description: "Punkt konnte nicht gelöscht werden",
        variant: "destructive"
      });
    }
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, NegativeListItem[]>);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">
              {documentType === 'supplier_code' ? 'Negativliste Lieferantenkodex' : 'Negativliste NDA/Geheimhaltung'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Diese Punkte werden in hochgeladenen Kundendokumenten gesucht
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Punkt hinzufügen
            </Button>
            <Button variant="outline" asChild>
              <label>
                <Upload className="h-4 w-4 mr-2" />
                Import aus Datei
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </Button>
          </div>

          {showAddForm && (
            <Card className="p-4 bg-muted/50">
              <div className="space-y-3">
                <div>
                  <Label>Titel</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Kurze Zusammenfassung"
                  />
                </div>
                <div>
                  <Label>Beschreibung</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Vollständige Beschreibung des Punktes"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Kategorie</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAdd} size="sm">
                    <Check className="h-4 w-4 mr-2" />
                    Speichern
                  </Button>
                  <Button onClick={() => setShowAddForm(false)} variant="ghost" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </Card>

      {Object.keys(groupedItems).length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Noch keine Negativpunkte vorhanden. Fügen Sie Punkte manuell hinzu oder importieren Sie sie aus einer Datei.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <Card key={category} className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                {category}
                <span className="text-xs text-muted-foreground">({categoryItems.length})</span>
              </h4>
              <div className="space-y-3">
                {categoryItems.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 bg-card">
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <Input
                          defaultValue={item.title}
                          onBlur={(e) => handleUpdate(item.id, { title: e.target.value })}
                        />
                        <Textarea
                          defaultValue={item.description}
                          onBlur={(e) => handleUpdate(item.id, { description: e.target.value })}
                          rows={3}
                        />
                        <Button onClick={() => setEditingId(null)} size="sm" variant="ghost">
                          Fertig
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">{item.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              onClick={() => setEditingId(item.id)}
                              variant="ghost"
                              size="sm"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(item.id)}
                              variant="ghost"
                              size="sm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NegativeListManager;