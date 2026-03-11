import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, X, Files, Trash2, RefreshCw, Sparkles } from "lucide-react";
import NegativeListManager from "./NegativeListManager";
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";
import { extractNegativePoints } from "@/lib/gemini";
import {
  getFoundationStore,
  saveCodeOfConduct,
  deleteCodeOfConduct,
  addAuxiliaryDocument,
  deleteAuxiliaryDocument,
  type StoredDocument,
} from "@/lib/foundationStore";
import { negativeListStore, LOCAL_USER_ID } from "@/lib/localStore";

const DataFoundation = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const userId = LOCAL_USER_ID;

  // Persisted documents from localStorage
  const [cocDoc, setCocDoc] = useState<StoredDocument | null>(() => getFoundationStore(userId).codeOfConduct);
  const [auxDocs, setAuxDocs] = useState<StoredDocument[]>(() => getFoundationStore(userId).auxiliary);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allDocs: StoredDocument[] = [...(cocDoc ? [cocDoc] : []), ...auxDocs];
  const hasDocuments = allDocs.length > 0;

  const loadFromStorage = useCallback(() => {
    const store = getFoundationStore(userId);
    setCocDoc(store.codeOfConduct);
    setAuxDocs(store.auxiliary);
  }, [userId]);

  const extractText = async (file: File): Promise<string> => {
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPDF) return await extract(file);
    return await file.text();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setPendingFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePending = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      const store = getFoundationStore(userId);
      const isFirstFile = !store.codeOfConduct;

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const content = await extractText(file);
        if (isFirstFile && i === 0 && !store.codeOfConduct) {
          saveCodeOfConduct(userId, file.name, file.size, content);
        } else {
          addAuxiliaryDocument(userId, file.name, file.size, content);
        }
      }

      const count = pendingFiles.length;
      setPendingFiles([]);
      toast({ title: t('toast.success'), description: t('dataFoundation.uploadSuccess', { count }) });
      loadFromStorage();
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      toast({ title: t('toast.error'), description: error.message || t('dataFoundation.uploadError'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = (doc: StoredDocument) => {
    if (!confirm(t('dataFoundation.confirmDelete'))) return;
    try {
      const store = getFoundationStore(userId);
      if (store.codeOfConduct?.id === doc.id) {
        const auxList = store.auxiliary;
        deleteCodeOfConduct(userId);
        if (auxList.length > 0) {
          saveCodeOfConduct(userId, auxList[0].fileName, auxList[0].fileSize, auxList[0].content);
          for (let i = 1; i < auxList.length; i++) {
            addAuxiliaryDocument(userId, auxList[i].fileName, auxList[i].fileSize, auxList[i].content);
          }
        }
      } else {
        deleteAuxiliaryDocument(userId, doc.id);
      }
      toast({ title: t('toast.success'), description: t('dataFoundation.deleteSuccess') });
      loadFromStorage();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast({ title: t('toast.error'), description: error.message || t('dataFoundation.deleteError'), variant: 'destructive' });
    }
  };

  const handleGenerateNegativeList = async () => {
    if (!hasDocuments) return;
    setGenerating(true);
    try {
      const allContent = allDocs.map(d => d.content).join('\n\n---\n\n');
      const extractedData = await extractNegativePoints(allContent, 'supplier_code');

      if (!extractedData?.points || extractedData.points.length === 0) {
        toast({ title: t('dataFoundation.generateNoPoints'), description: t('dataFoundation.generateNoPointsDesc') });
        return;
      }

      const pointsToInsert = extractedData.points.map((point: any) => ({
        user_id: LOCAL_USER_ID,
        document_type: 'supplier_code' as const,
        title: point.title,
        description: point.description,
        category: point.category,
      }));

      negativeListStore.insert(pointsToInsert);

      toast({
        title: t('toast.success'),
        description: t('dataFoundation.generateSuccess', { count: extractedData.points.length }),
      });

      window.dispatchEvent(new CustomEvent('negative-list-updated'));
    } catch (error: any) {
      console.error('Error generating negative list:', error);
      toast({ title: t('toast.error'), description: error.message || t('dataFoundation.generateError'), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{t('dashboard.dataFoundation')}</h2>
        <p className="text-muted-foreground">{t('dataFoundation.pageDescription')}</p>
      </div>

      {/* ──── Your Documents ──── */}
      <Card className="p-5">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Files className="h-5 w-5" />
              {t('dataFoundation.yourDocuments')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{t('dataFoundation.documentsDescription')}</p>
          </div>

          {allDocs.length > 0 && (
            <div className="space-y-2">
              {allDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSize)} · {t('dataFoundation.uploadedOn')} {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(doc)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div className="space-y-2">
              {pendingFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50 border-dashed">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} · {t('dataFoundation.pendingUpload')}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemovePending(idx)} disabled={uploading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium">{t('dataFoundation.dropzone')}</span>
            <span className="text-xs text-muted-foreground mt-1">{t('negativeList.supportedFormats')}</span>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt" multiple onChange={handleFileSelect} className="hidden" />
          </label>

          {pendingFiles.length > 0 && (
            <Button onClick={handleUpload} disabled={uploading} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? t('dataFoundation.uploading') : t('dataFoundation.uploadAll', { count: pendingFiles.length })}
            </Button>
          )}

          {hasDocuments && (
            <div className="pt-2 border-t">
              <Button onClick={handleGenerateNegativeList} disabled={generating} className="w-full" variant="default">
                {generating ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('dataFoundation.generating')}</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />{t('dataFoundation.generateNegativeList')}</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">{t('dataFoundation.generateHint')}</p>
            </div>
          )}
        </div>
      </Card>

      {/* ──── Negative List Supplier Code ──── */}
      <NegativeListManager documentType="supplier_code" />
    </div>
  );
};

export default DataFoundation;
