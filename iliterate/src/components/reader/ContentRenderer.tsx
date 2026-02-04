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

  // Normalize text for comparison (handles full-width/half-width differences)
  const normalizeText = useCallback((text: string): string => {
    return text
      // Normalize Unicode (NFC form)
      .normalize('NFC')
      // Convert full-width alphanumeric to half-width
      .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      // Normalize common punctuation variations
      .replace(/\u3000/g, ' ') // Full-width space to regular space
      .replace(/\u00A0/g, ' ') // Non-breaking space to regular space
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'");
  }, []);

  // Helper function to highlight text in a parsed DOM document
  const highlightTextInDocument = useCallback((
    doc: Document,
    container: Element,
    searchText: string,
    highlightId: string | null,
    className: string,
    title: string = ""
  ): boolean => {
    if (!searchText) return false;

    // Use TreeWalker to iterate through text nodes
    const walker = doc.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    // Collect all text nodes and their positions
    const textNodes: { node: Text; start: number; end: number }[] = [];
    let totalLength = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      const nodeLength = node.textContent?.length || 0;
      if (nodeLength > 0) {
        textNodes.push({
          node,
          start: totalLength,
          end: totalLength + nodeLength,
        });
        totalLength += nodeLength;
      }
    }

    // Get full text content
    const fullText = textNodes.map(tn => tn.node.textContent).join('');

    // Normalize both texts for comparison
    const normalizedFullText = normalizeText(fullText);
    const normalizedSearchText = normalizeText(searchText);

    // Find the search text in normalized full text
    let searchIndex = normalizedFullText.indexOf(normalizedSearchText);

    // If normalized search fails, try original text as fallback
    if (searchIndex === -1) {
      searchIndex = fullText.indexOf(searchText);
    }

    if (searchIndex === -1) return false;

    const searchEnd = searchIndex + searchText.length;

    // Find which text nodes contain the match
    const affectedNodes: { node: Text; startInNode: number; endInNode: number }[] = [];

    for (const tn of textNodes) {
      if (tn.end <= searchIndex) continue; // Before match
      if (tn.start >= searchEnd) break; // After match

      const startInNode = Math.max(0, searchIndex - tn.start);
      const endInNode = Math.min(tn.node.textContent?.length || 0, searchEnd - tn.start);

      affectedNodes.push({ node: tn.node, startInNode, endInNode });
    }

    if (affectedNodes.length === 0) return false;

    // Process nodes in reverse order to avoid index shifting issues
    for (let i = affectedNodes.length - 1; i >= 0; i--) {
      const { node: textNode, startInNode, endInNode } = affectedNodes[i];
      const text = textNode.textContent || '';

      const before = text.slice(0, startInNode);
      const matched = text.slice(startInNode, endInNode);
      const after = text.slice(endInNode);

      const mark = doc.createElement('mark');
      mark.className = className;
      if (highlightId) {
        mark.setAttribute('data-highlight-id', highlightId);
      } else {
        mark.setAttribute('data-current-selection', 'true');
      }
      if (title && i === 0) {
        mark.setAttribute('title', title);
      }
      mark.textContent = matched;

      const parent = textNode.parentNode;
      if (parent) {
        const fragment = doc.createDocumentFragment();
        if (before) fragment.appendChild(doc.createTextNode(before));
        fragment.appendChild(mark);
        if (after) fragment.appendChild(doc.createTextNode(after));
        parent.replaceChild(fragment, textNode);
      }
    }

    return true;
  }, [normalizeText]);

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

    // Add IDs to headings for TOC navigation
    let headingIndex = 0;
    html = html.replace(/<(h[1-3])([^>]*)>/gi, (match: string, tag: string, attrs: string) => {
      // Don't replace if already has an id
      if (attrs.includes('id=')) return match;
      const id = `heading-${headingIndex++}`;
      return `<${tag}${attrs} id="${id}">`;
    });

    // Parse HTML into DOM for robust text searching
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const container = doc.body.firstElementChild;

    if (!container) return html;

    // Apply saved highlights (sort by length, longest first)
    const sortedHighlights = [...highlights].sort(
      (a, b) => (b.selected_text?.length || 0) - (a.selected_text?.length || 0)
    );

    sortedHighlights.forEach((highlight) => {
      const isFocused = highlight.id === focusedHighlightId;
      const baseClass = "bg-yellow-200 dark:bg-yellow-800 cursor-pointer rounded px-0.5 transition-all duration-300";
      const focusClass = isFocused ? " ring-2 ring-primary ring-offset-2 bg-yellow-300 dark:bg-yellow-600" : "";
      const title = highlight.note || highlight.translation || "";

      highlightTextInDocument(
        doc,
        container,
        highlight.selected_text || "",
        highlight.id,
        `${baseClass}${focusClass}`,
        title
      );
    });

    // Apply current selection highlight
    if (currentSelection?.text) {
      highlightTextInDocument(
        doc,
        container,
        currentSelection.text,
        null,
        "bg-blue-100 dark:bg-blue-900/50 rounded px-0.5"
      );
    }

    return container.innerHTML;
  }, [content.body, isMounted, highlights, focusedHighlightId, currentSelection, highlightTextInDocument]);

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
