import { useEffect, useState, useMemo } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin } from '@react-pdf-viewer/search';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { supabase } from '@/integrations/supabase/client';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useTranslation } from 'react-i18next';

interface PDFViewerWithHighlightProps {
  filePath: string | null;
  highlightText?: string;
}

const PDFViewerWithHighlight = ({ filePath, highlightText }: PDFViewerWithHighlightProps) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  // Use useMemo to prevent re-creating plugins on every render
  const searchPluginInstance = useMemo(() => searchPlugin({
    keyword: highlightText || '',
  }), []);

  const defaultLayoutPluginInstance = useMemo(() => defaultLayoutPlugin(), []);

  useEffect(() => {
    const loadPDF = async () => {
      if (!filePath) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: signedUrlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (signedUrlError) throw signedUrlError;

        setFileUrl(data.signedUrl);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError(err.message || t('pdfViewer.loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [filePath, t]);

  // Highlight text when it changes
  useEffect(() => {
    if (highlightText && searchPluginInstance && fileUrl) {
      // Small delay to ensure PDF is loaded
      const timer = setTimeout(() => {
        try {
          searchPluginInstance.highlight([
            {
              keyword: highlightText,
              matchCase: false,
            },
          ]);
        } catch (err) {
          console.error('Error highlighting text:', err);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [highlightText, fileUrl]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10 rounded-lg">
        <LoadingSpinner text={t('pdfViewer.loading')} />
      </div>
    );
  }

  if (error || !fileUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10 rounded-lg p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">{error || t('pdfViewer.notAvailable')}</p>
          <p className="text-sm text-muted-foreground">{t('pdfViewer.notAvailableDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <div className="h-[800px] border rounded-lg overflow-hidden">
          <Viewer
            fileUrl={fileUrl}
            plugins={[defaultLayoutPluginInstance, searchPluginInstance]}
          />
        </div>
      </Worker>
    </div>
  );
};

export default PDFViewerWithHighlight;
