import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface HighlightRect { x: number; y: number; w: number; h: number; }

interface Props {
  dataUrl: string;
  highlight: string;
}

const PdfHighlightViewer = ({ dataUrl, highlight }: Props) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  // Shared ref — first page that finds a match claims the scroll
  const scrolledToMatch = useRef(false);

  useEffect(() => {
    scrolledToMatch.current = false;
  }, [highlight]);

  useEffect(() => {
    let cancelled = false;
    pdfjsLib.getDocument(dataUrl).promise.then(doc => {
      if (!cancelled) {
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      }
    });
    return () => { cancelled = true; };
  }, [dataUrl]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-muted/40 p-3 space-y-3">
      {pdfDoc && Array.from({ length: numPages }, (_, i) => (
        <PdfPage
          key={i + 1}
          pdfDoc={pdfDoc}
          pageNumber={i + 1}
          highlight={highlight}
          scrolledToMatch={scrolledToMatch}
        />
      ))}
    </div>
  );
};

const PdfPage = ({
  pdfDoc,
  pageNumber,
  highlight,
  scrolledToMatch,
}: {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  highlight: string;
  scrolledToMatch: React.MutableRefObject<boolean>;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [rects, setRects] = useState<HighlightRect[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const container = containerRef.current;
      if (!container) return;

      const page = await pdfDoc.getPage(pageNumber);
      const baseVp = page.getViewport({ scale: 1 });
      const containerWidth = container.clientWidth || 800;
      const scale = containerWidth / baseVp.width;
      const viewport = page.getViewport({ scale });

      if (cancelled) return;

      // Render page to canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (cancelled) return;
      setCanvasSize({ w: viewport.width, h: viewport.height });

      if (!highlight) { setRects([]); return; }

      // Extract text content and compute highlight rects
      const textContent = await page.getTextContent();
      const allItems = textContent.items;

      let combined = "";
      const ranges: { start: number; end: number; item: pdfjsLib.TextItem }[] = [];
      for (const raw of allItems) {
        // Skip TextMarkedContent items (no `str` property)
        if (!("str" in raw)) continue;
        const item = raw as pdfjsLib.TextItem;
        ranges.push({ start: combined.length, end: combined.length + item.str.length, item });
        combined += item.str;
      }

      // Try progressively shorter prefixes until we find a match
      let matchIdx = -1;
      let matchLen = 0;
      for (const attempt of [highlight, highlight.slice(0, 120), highlight.slice(0, 60)]) {
        if (attempt.length < 15) break;
        const idx = combined.toLowerCase().indexOf(attempt.toLowerCase());
        if (idx !== -1) { matchIdx = idx; matchLen = attempt.length; break; }
      }

      if (matchIdx === -1) { setRects([]); return; }

      const matchEnd = matchIdx + matchLen;
      const newRects: HighlightRect[] = [];

      for (const { start, end, item } of ranges) {
        if (end <= matchIdx || start >= matchEnd) continue;
        // item.transform = [a, b, c, d, tx, ty] — tx/ty is bottom-left of text in PDF coords
        const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const w = item.width * scale;
        const h = Math.max(item.height * scale, 10);
        // vy is the baseline; subtract h to get the top of the text box
        newRects.push({ x: vx, y: vy - h, w, h });
      }

      if (cancelled) return;
      setRects(newRects);

      // Scroll to the first page that has a match
      if (newRects.length > 0 && !scrolledToMatch.current) {
        scrolledToMatch.current = true;
        setTimeout(() => container.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, highlight]);

  return (
    <div ref={containerRef} className="relative shadow-md bg-white mx-auto" style={{ width: "100%" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      {rects.length > 0 && canvasSize.w > 0 && (
        <svg
          viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          {rects.map((r, i) => (
            <rect
              key={i}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill="rgba(255, 244, 64, 0.45)"
              rx="2"
            />
          ))}
        </svg>
      )}
    </div>
  );
};

export default PdfHighlightViewer;
