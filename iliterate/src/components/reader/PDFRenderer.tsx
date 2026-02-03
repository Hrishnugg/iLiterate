"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextSelection } from "./TextHighlighter";

// Set worker source (webpack/vite handles this differently)
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface PDFRendererProps {
  url: string;
  contentId: string;
  onSelection?: (selection: TextSelection | null) => void;
}

interface PDFPage {
  pageNumber: number;
  textContent: string;
  textItems: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export function PDFRenderer({ url, contentId, onSelection }: PDFRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);

        // Extract text from all pages
        const extractedPages: PDFPage[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const textItems = textContent.items.map((item: unknown) => {
            const typed = item as { str: string; transform: number[]; width: number; height: number };
            return {
              text: typed.str,
              x: typed.transform[4],
              y: typed.transform[5],
              width: typed.width,
              height: typed.height,
            };
          });

          extractedPages.push({
            pageNumber: i,
            textContent: textItems.map((t) => t.text).join(" "),
            textItems,
          });
        }
        setPages(extractedPages);
        setLoading(false);
      } catch (err) {
        console.error("PDF load error:", err);
        setError("Failed to load PDF");
        setLoading(false);
      }
    };

    loadPDF();
  }, [url]);

  // Render a page
  const renderPage = useCallback(
    async (pageNumber: number) => {
      if (!pdf) return;

      const canvas = canvasRefs.current.get(pageNumber);
      if (!canvas) return;

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const context = canvas.getContext("2d");
      if (!context) return;

      await page.render({
        canvasContext: context,
        viewport,
        canvas,
      }).promise;
    },
    [pdf, scale]
  );

  // Render visible pages
  useEffect(() => {
    if (!pdf) return;

    // Render current page and adjacent pages
    const pagesToRender = [currentPage];
    if (currentPage > 1) pagesToRender.push(currentPage - 1);
    if (currentPage < numPages) pagesToRender.push(currentPage + 1);

    pagesToRender.forEach((pageNum) => {
      renderPage(pageNum);
    });
  }, [pdf, currentPage, numPages, renderPage]);

  // Handle text selection in PDF
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      onSelection?.(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      onSelection?.(null);
      return;
    }

    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate approximate offsets based on current page text
    const currentPageData = pages[currentPage - 1];
    if (currentPageData) {
      const fullText = currentPageData.textContent;
      const index = fullText.indexOf(text);

      const contextBefore = fullText.slice(Math.max(0, index - 50), index);
      const contextAfter = fullText.slice(index + text.length, index + text.length + 50);

      onSelection?.({
        text,
        startOffset: index >= 0 ? index : 0,
        endOffset: index >= 0 ? index + text.length : text.length,
        contextBefore,
        contextAfter,
        range: range.cloneRange(),
      });
    }
  }, [currentPage, pages, onSelection]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center gap-4"
      onMouseUp={handleMouseUp}
    >
      {/* Page navigation */}
      <div className="sticky top-0 z-10 flex w-full items-center justify-center gap-4 bg-background/95 p-4 backdrop-blur">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm">
          Page {currentPage} of {numPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage === numPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="ml-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Zoom:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          >
            -
          </Button>
          <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          >
            +
          </Button>
        </div>
      </div>

      {/* Page canvases */}
      <div className="space-y-8 pb-8">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <div
            key={pageNum}
            className={`relative shadow-lg ${
              pageNum === currentPage ? "ring-2 ring-primary" : ""
            }`}
            id={`page-${pageNum}`}
          >
            <canvas
              ref={(el) => {
                if (el) canvasRefs.current.set(pageNum, el);
              }}
              className="max-w-full"
            />
            <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
              {pageNum}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
