"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ePub from "epubjs";
import { Loader2, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextSelection } from "./TextHighlighter";
import { cn } from "@/lib/utils";

interface EPUBRendererProps {
  url: string;
  contentId: string;
  onSelection?: (selection: TextSelection | null) => void;
  onTocUpdate?: (toc: Array<{ label: string; href: string }>) => void;
}

export function EPUBRenderer({
  url,
  contentId,
  onSelection,
  onTocUpdate,
}: EPUBRendererProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<ePub.Rendition | null>(null);
  const bookRef = useRef<ePub.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [toc, setToc] = useState<Array<{ label: string; href: string }>>([]);

  // Use refs for callbacks to avoid re-initializing EPUB on every parent render
  const onSelectionRef = useRef(onSelection);
  const onTocUpdateRef = useRef(onTocUpdate);

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onSelectionRef.current = onSelection;
    onTocUpdateRef.current = onTocUpdate;
  }, [onSelection, onTocUpdate]);

  // Initialize EPUB - only depends on url
  useEffect(() => {
    const initEPUB = async () => {
      try {
        setLoading(true);
        setError(null);

        // Create book
        const book = ePub(url);
        bookRef.current = book;

        // Wait for book to be ready
        await book.ready;

        // Get table of contents
        const navigation = await book.navigation;
        const tocItems = navigation.toc.map((item) => ({
          label: item.label,
          href: item.href,
        }));
        setToc(tocItems);
        onTocUpdateRef.current?.(tocItems);

        // Create rendition
        if (viewerRef.current) {
          const rendition = book.renderTo(viewerRef.current, {
            width: "100%",
            height: "100%",
            spread: "none",
          });
          renditionRef.current = rendition;

          // Set initial font size
          rendition.themes.fontSize(`${fontSize}%`);

          // Handle location changes
          rendition.on("locationChanged", (location: { start: string; end: string; atStart?: boolean; atEnd?: boolean }) => {
            setCurrentLocation(location.start);
            setAtStart(!!location.atStart);
            setAtEnd(!!location.atEnd);
          });

          // Handle text selection
          rendition.on("selected", (cfiRange: string) => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) {
              const text = selection.toString().trim();
              const range = selection.getRangeAt(0);

              // Get context
              const fullText = rendition.getRange(cfiRange)?.toString() || text;
              const contextLength = 50;
              const startIdx = fullText.indexOf(text);
              const contextBefore = fullText.slice(Math.max(0, startIdx - contextLength), startIdx);
              const contextAfter = fullText.slice(startIdx + text.length, startIdx + text.length + contextLength);

              onSelectionRef.current?.({
                text,
                startOffset: 0, // EPUB uses CFI, not offsets
                endOffset: 0,
                contextBefore,
                contextAfter,
                range: range.cloneRange(),
              });
            }
          });

          // Display first chapter
          await rendition.display();
          setLoading(false);
        }
      } catch (err) {
        console.error("EPUB load error:", err);
        setError("Failed to load EPUB");
        setLoading(false);
      }
    };

    initEPUB();

    // Cleanup
    return () => {
      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, [url]); // Only depend on url - callbacks accessed via refs

  // Update font size
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize]);

  // Navigation handlers
  const goPrev = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  const goNext = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const goToTocItem = useCallback((href: string) => {
    renditionRef.current?.display(href);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext]);

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
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={atStart}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={atEnd}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {/* Font size controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Size:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFontSize((s) => Math.max(50, s - 10))}
              aria-label="Decrease font size"
            >
              A-
            </Button>
            <span className="text-sm w-12 text-center">{fontSize}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFontSize((s) => Math.min(200, s + 10))}
              aria-label="Increase font size"
            >
              A+
            </Button>
          </div>
        </div>
      </div>

      {/* TOC (collapsible) */}
      {toc.length > 0 && (
        <div className="border-b bg-muted/30 p-2">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4" />
              Table of Contents ({toc.length} chapters)
            </summary>
            <nav aria-label="Table of contents" className="mt-2 max-h-48 overflow-y-auto">
              {toc.map((item, index) => (
                <button
                  key={index}
                  onClick={() => goToTocItem(item.href)}
                  className={cn(
                    "block w-full text-left px-3 py-1.5 text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    currentLocation.includes(item.href) && "bg-accent text-accent-foreground"
                  )}
                  aria-current={currentLocation.includes(item.href) ? "location" : undefined}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </details>
        </div>
      )}

      {/* EPUB Viewer */}
      <div
        ref={viewerRef}
        className="flex-1 overflow-hidden bg-muted/20 p-4"
        style={{ minHeight: "600px" }}
      />
    </div>
  );
}
