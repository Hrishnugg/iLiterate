"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Content, Highlight } from "@/types/database";
import { TextSelection } from "./TextHighlighter";

// Dynamic imports to avoid SSR issues with browser-only APIs (DOMMatrix, etc.)
const PDFRenderer = dynamic(() => import("./PDFRenderer").then(mod => mod.PDFRenderer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8">Loading PDF...</div>,
});

const EPUBRenderer = dynamic(() => import("./EPUBRenderer").then(mod => mod.EPUBRenderer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8">Loading EPUB...</div>,
});

interface ContentRendererProps {
  content: Content;
  highlights?: Highlight[];
  focusedHighlightId?: string | null;
  currentSelection?: TextSelection | null;
  onSelection?: (selection: TextSelection | null) => void;
  onTocUpdate?: (toc: Array<{ label: string; href: string }>) => void;
  onHighlightClick?: (highlight: Highlight) => void;
}

export function ContentRenderer({
  content,
  highlights = [],
  focusedHighlightId,
  currentSelection,
  onSelection,
  onTocUpdate,
  onHighlightClick,
}: ContentRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Determine content type from source_url or content_type
  const isPDF =
    content.source_url?.toLowerCase().endsWith(".pdf") ||
    content.content_type === "pdf";
  const isEPUB =
    content.source_url?.toLowerCase().endsWith(".epub") ||
    content.content_type === "epub";

  // Track if mounted to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sanitize and apply highlights to HTML content (only on client)
  const processedBody = useMemo(() => {
    if (!isMounted) return "";

    // Dynamic import of DOMPurify to avoid SSR issues
    const DOMPurify = require("dompurify");
    let html = DOMPurify.sanitize(content.body, {
      ALLOWED_TAGS: [
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p", "br", "hr",
        "ul", "ol", "li",
        "blockquote", "pre", "code",
        "strong", "em", "b", "i", "u", "s",
        "a", "span", "div",
        "table", "thead", "tbody", "tr", "th", "td",
        "img", "figure", "figcaption",
        "mark", // Allow mark for highlights
      ],
      ALLOWED_ATTR: [
        "href", "target", "rel",
        "src", "alt", "title",
        "class", "id",
        "colspan", "rowspan",
        "data-highlight-id", // Allow highlight id
      ],
      ALLOW_DATA_ATTR: true,
    });

    // Apply highlights to the HTML string
    // Sort by length (longest first) to avoid partial replacements
    const sortedHighlights = [...highlights].sort(
      (a, b) => (b.selected_text?.length || 0) - (a.selected_text?.length || 0)
    );

    sortedHighlights.forEach((highlight) => {
      const textToFind = highlight.selected_text;
      if (!textToFind) return;

      // Escape special regex characters
      const escapedText = textToFind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Only replace if not already inside a mark tag
      // Use a regex that matches the text but not inside existing marks
      const regex = new RegExp(`(?<!<mark[^>]*>)${escapedText}(?![^<]*</mark>)`, "g");

      const isFocused = highlight.id === focusedHighlightId;
      const baseClass = "bg-yellow-200 dark:bg-yellow-800 cursor-pointer rounded px-0.5 transition-all duration-300";
      const focusClass = isFocused ? " ring-2 ring-primary ring-offset-2 bg-yellow-300 dark:bg-yellow-600" : "";

      // Only replace the first occurrence
      let replaced = false;
      html = html.replace(regex, (match: string) => {
        if (replaced) return match;
        replaced = true;
        const title = (highlight.note || highlight.translation || "").replace(/"/g, "&quot;");
        return `<mark data-highlight-id="${highlight.id}" class="${baseClass}${focusClass}" title="${title}">${match}</mark>`;
      });
    });

    // Apply temporary highlight for current selection (subtle blue)
    if (currentSelection?.text) {
      const selectionText = currentSelection.text;
      const escapedSelection = selectionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const selectionRegex = new RegExp(`(?<!<mark[^>]*>)${escapedSelection}(?![^<]*</mark>)`, "g");

      let selectionReplaced = false;
      html = html.replace(selectionRegex, (match: string) => {
        if (selectionReplaced) return match;
        selectionReplaced = true;
        return `<mark class="bg-blue-100 dark:bg-blue-900/50 rounded px-0.5" data-current-selection="true">${match}</mark>`;
      });
    }

    return html;
  }, [content.body, isMounted, highlights, focusedHighlightId, currentSelection]);

  // Handle highlight clicks via event delegation
  useEffect(() => {
    if (!contentRef.current || !onHighlightClick) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "MARK" && target.dataset.highlightId) {
        e.stopPropagation();
        const highlight = highlights.find((h) => h.id === target.dataset.highlightId);
        if (highlight) {
          onHighlightClick(highlight);
        }
      }
    };

    contentRef.current.addEventListener("click", handleClick);
    return () => contentRef.current?.removeEventListener("click", handleClick);
  }, [highlights, onHighlightClick]);

  // Handle focused highlight - scroll into view
  useEffect(() => {
    if (!focusedHighlightId || !contentRef.current) return;

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(() => {
      const mark = contentRef.current?.querySelector(`mark[data-highlight-id="${focusedHighlightId}"]`);
      if (mark) {
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [focusedHighlightId]);

  // Render based on type
  if (isPDF && content.source_url) {
    return (
      <PDFRenderer
        url={content.source_url}
        contentId={content.id}
        onSelection={onSelection}
      />
    );
  }

  if (isEPUB && content.source_url) {
    return (
      <EPUBRenderer
        url={content.source_url}
        contentId={content.id}
        onSelection={onSelection}
        onTocUpdate={onTocUpdate}
      />
    );
  }

  // Default: HTML/Article rendering
  if (!isMounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold leading-tight">{content.title}</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold leading-tight">{content.title}</h1>
      <div
        ref={contentRef}
        onMouseUp={() => {
          // Handle text selection for article content
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) {
            const text = selection.toString().trim();
            if (text && onSelection) {
              const range = selection.getRangeAt(0);
              const container = range.commonAncestorContainer.parentElement;
              const fullText = container?.textContent || "";

              // Calculate approximate offset
              const preSelectionRange = document.createRange();
              preSelectionRange.selectNodeContents(container || document.body);
              preSelectionRange.setEnd(range.startContainer, range.startOffset);
              const startOffset = preSelectionRange.toString().length;
              const endOffset = startOffset + text.length;

              const contextLength = 50;
              const contextBefore = fullText.slice(Math.max(0, startOffset - contextLength), startOffset);
              const contextAfter = fullText.slice(endOffset, endOffset + contextLength);

              onSelection({
                text,
                startOffset,
                endOffset,
                contextBefore,
                contextAfter,
                range: range.cloneRange(),
              });
            }
          }
        }}
        dangerouslySetInnerHTML={{ __html: processedBody }}
        className="space-y-4 text-lg leading-relaxed [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic"
      />
    </div>
  );
}
