import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Trash2, Edit2, X, Check, ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useTranslation } from "react-i18next";
import { extractNegativePoints } from "@/lib/gemini";
import { negativeListStore, LOCAL_USER_ID, type NegativeListItem } from "@/lib/localStore";

interface NegativeListManagerProps {
  documentType: 'supplier_code' | 'nda';
}

type FilterSource = 'all' | 'manual' | 'ai_generated' | 'review';
type SortBy = 'category' | 'name_asc' | 'newest' | 'oldest';

const NegativeListManager = ({ documentType }: NegativeListManagerProps) => {
  const [items, setItems] = useState<NegativeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', category: 'Sonstiges' });
  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [sortBy, setSortBy] = useState<SortBy>('category');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedPoints, setExpandedPoints] = useState<Set<string>>(new Set());
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

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const togglePoint = (id: string) => {
    setExpandedPoints(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
        source: 'ai_generated' as const,
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
      source: 'manual',
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

  // Filter
  const filteredItems = items.filter(item => {
    if (filterSource === 'all') return true;
    if (filterSource === 'review') return item.source === 'review';
    if (filterSource === 'ai_generated') return item.source === 'ai_generated';
    if (filterSource === 'manual') return item.source === 'manual' || !item.source;
    return true;
  });

  // Sort within groups
  const sortItems = (arr: NegativeListItem[]): NegativeListItem[] => {
    if (sortBy === 'name_asc') return [...arr].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'newest') return [...arr].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortBy === 'oldest') return [...arr].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return arr;
  };

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, NegativeListItem[]>);

  // Source counts for filter badges
  const sourceCounts = {
    manual: items.filter(i => i.source === 'manual' || !i.source).length,
    ai_generated: items.filter(i => i.source === 'ai_generated').length,
    review: items.filter(i => i.source === 'review').length,
  };

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

      {/* Filter + Sort controls */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            {(['all', 'manual', 'ai_generated', 'review'] as FilterSource[]).map(src => {
              const label = src === 'all' ? `All (${items.length})` : src === 'manual' ? `Manual (${sourceCounts.manual})` : src === 'ai_generated' ? `From Docs (${sourceCounts.ai_generated})` : `From Review (${sourceCounts.review})`;
              const count = src === 'all' ? items.length : sourceCounts[src as keyof typeof sourceCounts];
              if (src !== 'all' && count === 0) return null;
              return (
                <button
                  key={src}
                  onClick={() => setFilterSource(src)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterSource === src ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="ml-auto">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Sort: Category</SelectItem>
                <SelectItem value="name_asc">Sort: Name A–Z</SelectItem>
                <SelectItem value="newest">Sort: Newest</SelectItem>
                <SelectItem value="oldest">Sort: Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {Object.keys(groupedItems).length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {filterSource !== 'all' ? 'No items match the current filter.' : t('negativeList.noPoints')}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedItems).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryItems]) => {
            const isExpanded = expandedCategories.has(category);
            const sorted = sortItems(categoryItems);
            return (
              <Card key={category} className="overflow-hidden">
                {/* Category header — clickable */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                >
                  <span className="font-semibold flex items-center gap-2">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    {translateCategory(category)}
                  </span>
                  <span className="text-xs text-muted-foreground">{categoryItems.length} point{categoryItems.length !== 1 ? 's' : ''}</span>
                </button>

                {/* Points list */}
                {isExpanded && (
                  <div className="border-t divide-y">
                    {sorted.map((item) => (
                      <div key={item.id} className="px-4 py-2">
                        {editingId === item.id ? (
                          <div className="space-y-2 py-1">
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
                          <>
                            {/* Point title row — clickable to expand description */}
                            <button
                              onClick={() => togglePoint(item.id)}
                              className="w-full flex items-center justify-between gap-2 py-1 text-left group"
                            >
                              <span className="flex items-center gap-2 flex-1 min-w-0">
                                {expandedPoints.has(item.id)
                                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <span className="font-medium text-sm truncate">{item.title}</span>
                                {item.source === 'review' && (
                                  <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30 shrink-0">
                                    Review
                                  </Badge>
                                )}
                                {item.source === 'ai_generated' && (
                                  <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30 shrink-0">
                                    Docs
                                  </Badge>
                                )}
                              </span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                                <Button onClick={() => setEditingId(item.id)} variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button onClick={() => handleDelete(item.id)} variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </button>

                            {/* Description — shown when expanded */}
                            {expandedPoints.has(item.id) && (
                              <p className="text-sm text-muted-foreground ml-6 pb-2 pr-2">{item.description}</p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NegativeListManager;
