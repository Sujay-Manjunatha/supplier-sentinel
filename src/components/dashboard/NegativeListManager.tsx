import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Trash2, Edit2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useTranslation } from "react-i18next";
import { extractNegativePoints } from "@/lib/gemini";
import { negativeListStore, LOCAL_USER_ID, type NegativeListItem } from "@/lib/localStore";

interface NegativeListManagerProps {
  documentType: 'supplier_code' | 'nda';
}

const NegativeListManager = ({ documentType }: NegativeListManagerProps) => {
  const [items, setItems] = useState<NegativeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', category: 'Sonstiges' });
  const { toast } = useToast();
  const { t } = useTranslation();

  const categoryPrefix = documentType === 'supplier_code' ? 'negativeList.categories.supplier' : 'negativeList.categories.nda';
  const categoryKeys = Object.keys(t(categoryPrefix, { returnObjects: true }) as Record<string, string>);
  const categories = categoryKeys.map(key => t(`${categoryPrefix}.${key}`));

  const translateCategory = (dbCategory: string): string => {
    const translated = t(`${categoryPrefix}.${dbCategory}`, { defaultValue: '' });
    if (translated && translated !== '') return translated;
    return dbCategory;
  };

  useEffect(() => {
    fetchItems();
  }, [documentType]);

  useEffect(() => {
    const handler = () => fetchItems();
    window.addEventListener('negative-list-updated', handler);
    return () => window.removeEventListener('negative-list-updated', handler);
  }, []);

  const fetchItems = () => {
    const data = negativeListStore.getAll(documentType);
    const sorted = [...data].sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setItems(sorted);
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
        throw new Error(t('toast.fileTypeNotSupported'));
      }

      const extractedData = await extractNegativePoints(content, documentType);

      const pointsToInsert = extractedData.points.map((point: any) => ({
        user_id: LOCAL_USER_ID,
        document_type: documentType,
        title: point.title,
        description: point.description,
        category: point.category,
      }));

      negativeListStore.insert(pointsToInsert);

      toast({
        title: t('toast.success'),
        description: `${extractedData.points.length} ${t('toast.pointsImported')}`
      });

      fetchItems();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: t('toast.error'),
        description: error.message || t('toast.fileProcessError'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleAdd = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: t('toast.error'),
        description: t('toast.titleRequired'),
        variant: "destructive"
      });
      return;
    }

    negativeListStore.insert([{
      user_id: LOCAL_USER_ID,
      document_type: documentType,
      title: formData.title,
      description: formData.description,
      category: formData.category,
    }]);

    toast({ title: t('toast.success'), description: t('toast.pointAdded') });
    setFormData({ title: '', description: '', category: 'Sonstiges' });
    setShowAddForm(false);
    fetchItems();
  };

  const handleUpdate = (id: string, updates: Partial<NegativeListItem>) => {
    negativeListStore.update(id, updates);
    toast({ title: t('toast.success'), description: t('toast.pointUpdated') });
    setEditingId(null);
    fetchItems();
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('toast.confirmDelete'))) return;
    negativeListStore.delete(id);
    toast({ title: t('toast.success'), description: t('toast.pointDeleted') });
    fetchItems();
  };

  const handleDeleteAll = () => {
    if (items.length === 0) return;
    if (!confirm(t('toast.confirmDeleteAll'))) return;
    negativeListStore.deleteByType(documentType);
    toast({ title: t('toast.success'), description: t('toast.allPointsDeleted') });
    fetchItems();
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, NegativeListItem[]>);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">
              {documentType === 'supplier_code' ? t('negativeList.titleSupplier') : t('negativeList.titleNda')}
            </h3>
            <p className="text-sm text-muted-foreground">{t('negativeList.description')}</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              {t('negativeList.addPoint')}
            </Button>
            <Button variant="outline" asChild>
              <label>
                <Upload className="h-4 w-4 mr-2" />
                {t('negativeList.importFile')}
                <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </Button>
            {items.length > 0 && (
              <Button variant="outline" onClick={handleDeleteAll} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('negativeList.deleteAll')}
              </Button>
            )}
          </div>

          {showAddForm && (
            <Card className="p-4 bg-muted/50">
              <div className="space-y-3">
                <div>
                  <Label>{t('negativeList.pointTitle')}</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('negativeList.titlePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('negativeList.pointDescription')}</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('negativeList.descriptionPlaceholder')}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>{t('negativeList.pointCategory')}</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryKeys.map((key, idx) => (
                        <SelectItem key={key} value={key}>{categories[idx]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAdd} size="sm">
                    <Check className="h-4 w-4 mr-2" />
                    {t('common.save')}
                  </Button>
                  <Button onClick={() => setShowAddForm(false)} variant="ghost" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </Card>

      {Object.keys(groupedItems).length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('negativeList.noPoints')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <Card key={category} className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                {translateCategory(category)}
                <span className="text-xs text-muted-foreground">({categoryItems.length})</span>
              </h4>
              <div className="space-y-2">
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
                          {t('common.done')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{item.title}</p>
                            {item.source === 'review' && (
                              <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                                Added from review
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button onClick={() => setEditingId(item.id)} variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button onClick={() => handleDelete(item.id)} variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
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
