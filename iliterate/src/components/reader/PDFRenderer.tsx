"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextSelection } from "./TextHighlighter";

// Worker is served from public/ — copied from node_modules/pdfjs-dist/build/pdf.worker.min.mjs
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface PDFRendererProps {
  url: string;
  contentId?: string;
  onSelection?: (selection: TextSelection | null) => void;
  integratedToolbar?: boolean;
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

export function PDFRenderer({
  url,
  contentId: _contentId,
  onSelection,
  integratedToolbar = false,
}: PDFRendererProps) {
  void _contentId;
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasks = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());
  const renderedScales = useRef<Map<number, number>>(new Map());
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [isInitialRenderLoading, setIsInitialRenderLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);

  const getToolbarOffset = useCallback(() => {
    const toolbarHeight = toolbarRef.current?.offsetHeight ?? 0;
    return toolbarHeight + 24;
  }, []);

  // Load PDF
  useEffect(() => {
    let isCancelled = false;
    let loadedPdf: pdfjsLib.PDFDocumentProxy | null = null;
    const renderTaskRegistry = renderTasks.current;
    const renderedScaleRegistry = renderedScales.current;

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        setCurrentPage(1);
        setPages([]);
        setIsInitialRenderLoading(true);
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        if (isCancelled) {
          await pdfDoc.destroy();
          return;
        }

        loadedPdf = pdfDoc;
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
        if (isCancelled) {
          await pdfDoc.destroy();
          return;
        }
        setPages(extractedPages);
        setLoading(false);
      } catch (err) {
        if (isCancelled) {
          return;
        }
        console.error("PDF load error:", err);
        setError("Failed to load PDF");
        setLoading(false);
      }
    };

    void loadPDF();

    return () => {
      isCancelled = true;
      renderTaskRegistry.forEach((task) => task.cancel());
      renderTaskRegistry.clear();
      renderedScaleRegistry.clear();
      if (loadedPdf) {
        void loadedPdf.destroy();
      }
    };
  }, [url]);

  // Render a page
  const renderPage = useCallback(
    async (pageNumber: number) => {
      if (!pdf) return;

      const canvas = canvasRefs.current.get(pageNumber);
      if (!canvas) return;

      const existingTask = renderTasks.current.get(pageNumber);
      if (existingTask) {
        existingTask.cancel();
        renderTasks.current.delete(pageNumber);
      }

      if (renderedScales.current.get(pageNumber) === scale) {
        return;
      }

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const context = canvas.getContext("2d");
      if (!context) return;

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });
      renderTasks.current.set(pageNumber, renderTask);

      try {
        await renderTask.promise;
        renderedScales.current.set(pageNumber, scale);
      } catch (error) {
        const isCancelledError =
          error instanceof Error && error.name === "RenderingCancelledException";
        if (!isCancelledError) {
          throw error;
        }
      } finally {
        if (renderTasks.current.get(pageNumber) === renderTask) {
          renderTasks.current.delete(pageNumber);
        }
      }
    },
    [pdf, scale]
  );

  // Render visible pages
  useEffect(() => {
    if (!pdf || loading) return;
    const renderTaskRegistry = renderTasks.current;
    let isCancelled = false;

    // Render current page and adjacent pages
    const pagesToRender = [currentPage];
    if (currentPage > 1) pagesToRender.push(currentPage - 1);
    if (currentPage < numPages) pagesToRender.push(currentPage + 1);

    const frameId = requestAnimationFrame(() => {
      void Promise.all(pagesToRender.map((pageNum) => renderPage(pageNum))).then(() => {
        if (!isCancelled) {
          setIsInitialRenderLoading(false);
        }
      });
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameId);
      pagesToRender.forEach((pageNum) => {
        renderTaskRegistry.get(pageNum)?.cancel();
      });
    };
  }, [pdf, loading, currentPage, numPages, renderPage]);

  const scrollToPage = useCallback((pageNumber: number) => {
    const pageElement = pageRefs.current.get(pageNumber);
    const container = containerRef.current;
    if (!pageElement || !container) {
      return;
    }

    const toolbarOffset = getToolbarOffset();
    container.scrollTo({
      top: Math.max(0, pageElement.offsetTop - toolbarOffset),
      behavior: "auto",
    });
  }, [getToolbarOffset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || loading || isInitialRenderLoading) {
      return;
    }

    const updateCurrentPageFromScroll = () => {
      const toolbarOffset = getToolbarOffset();
      const threshold = container.scrollTop + toolbarOffset;

      let nextPage = 1;

      for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
        const pageElement = pageRefs.current.get(pageNumber);
        if (!pageElement) {
          continue;
        }

        if (pageElement.offsetTop <= threshold) {
          nextPage = pageNumber;
        } else {
          break;
        }
      }

      setCurrentPage((current) => (current === nextPage ? current : nextPage));
    };

    updateCurrentPageFromScroll();
    container.addEventListener("scroll", updateCurrentPageFromScroll, {
      passive: true,
    });

    return () => {
      container.removeEventListener("scroll", updateCurrentPageFromScroll);
    };
  }, [getToolbarOffset, isInitialRenderLoading, loading, numPages]);

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
      <div className="flex h-full min-h-[18rem] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-background"
      onMouseUp={handleMouseUp}
    >
      {/* Page navigation */}
      <div
        ref={toolbarRef}
        className={`sticky top-0 z-10 flex w-full items-center justify-center gap-4 border-b bg-background px-6 py-4 ${
          integratedToolbar ? "" : "backdrop-blur"
        }`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const nextPage = Math.max(1, currentPage - 1);
            scrollToPage(nextPage);
          }}
          disabled={currentPage === 1 || isInitialRenderLoading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm">
          Page {currentPage} of {numPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const nextPage = Math.min(numPages, currentPage + 1);
            scrollToPage(nextPage);
          }}
          disabled={currentPage === numPages || isInitialRenderLoading}
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

      {isInitialRenderLoading ? (
        <div className="pointer-events-none absolute inset-x-0 top-[73px] bottom-0 z-10 flex items-center justify-center bg-background/72 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-4 animate-spin" />
            Rendering pages...
          </div>
        </div>
      ) : null}

      {/* Page canvases */}
      <div className="flex flex-col items-center gap-8 bg-muted/20 px-6 py-6">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <div
            key={pageNum}
            ref={(el) => {
              if (el) {
                pageRefs.current.set(pageNum, el);
              } else {
                pageRefs.current.delete(pageNum);
              }
            }}
            className={`relative mx-auto w-fit shadow-lg ${
              pageNum === currentPage ? "ring-2 ring-primary" : ""
            }`}
            id={`page-${pageNum}`}
          >
            <canvas
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(pageNum, el);
                } else {
                  canvasRefs.current.delete(pageNum);
                }
              }}
              className="max-w-full bg-white"
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
