"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Content, Highlight } from "@/types/database";
import { TextSelection } from "./TextHighlighter";
import { buildReaderSegments, ReaderMode, ReaderSegment } from "./karaoke";

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
  sourceImageUrl?: string | null;
  sourceImageAlt?: string | null;
  highlights?: Highlight[];
  focusedHighlightId?: string | null;
  currentSelection?: TextSelection | null;
  readerMode?: ReaderMode;
  readerSegments?: ReaderSegment[];
  activeReaderSegmentId?: string | null;
  onSelection?: (selection: TextSelection | null) => void;
  onTocUpdate?: (toc: Array<{ label: string; href: string }>) => void;
  onHighlightClick?: (highlight: Highlight) => void;
  onReaderSegmentsChange?: (segments: ReaderSegment[]) => void;
  onReaderSegmentSelect?: (segment: ReaderSegment) => void;
}

export function ContentRenderer({
  content,
  sourceImageUrl = null,
  sourceImageAlt = null,
  highlights = [],
  focusedHighlightId,
  currentSelection,
  readerMode = "default",
  readerSegments = [],
  activeReaderSegmentId,
  onSelection,
  onTocUpdate,
  onHighlightClick,
  onReaderSegmentsChange,
  onReaderSegmentSelect,
}: ContentRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Determine content type from source_url or content_type
  const isPDF =
    content.source_url?.toLowerCase().endsWith(".pdf") ||
    content.content_type === "pdf";
  const isEPUB =
    content.source_url?.toLowerCase().endsWith(".epub") ||
    content.content_type === "epub";
  const isKaraokeMode = readerMode === "karaoke" && !isPDF && !isEPUB;
  const hasSourceImage = Boolean(sourceImageUrl) && !isPDF && !isEPUB;

  // Track if mounted to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Normalize a single character (full-width to half-width, etc.)
  const normalizeChar = useCallback((ch: string): string => {
    const code = ch.charCodeAt(0);
    // Full-width alphanumeric/punctuation to half-width
    if (code >= 0xFF01 && code <= 0xFF5E) {
      return String.fromCharCode(code - 0xFEE0);
    }
    // Full-width space
    if (code === 0x3000 || code === 0x00A0) return ' ';
    // Fancy quotes
    if (ch === '\u201C' || ch === '\u201D') return '"';
    if (ch === '\u2018' || ch === '\u2019') return "'";
    return ch;
  }, []);

  // Normalize text for comparison (handles full-width/half-width differences)
  const normalizeText = useCallback((text: string): string => {
    return text.normalize('NFC').split('').map(normalizeChar).join('');
  }, [normalizeChar]);

  // Normalize text with whitespace collapsing and position mapping
  // Returns normalized string and a mapping array: mapping[normalizedIdx] = originalIdx
  const normalizeWithMapping = useCallback((text: string): { normalized: string; mapping: number[] } => {
    const nfc = text.normalize('NFC');
    let normalized = '';
    const mapping: number[] = [];
    let lastWasSpace = false;

    for (let i = 0; i < nfc.length; i++) {
      const ch = normalizeChar(nfc[i]);

      if (/\s/.test(ch)) {
        if (!lastWasSpace) {
          normalized += ' ';
          mapping.push(i);
          lastWasSpace = true;
        }
        // Skip additional whitespace - don't add to normalized
      } else {
        normalized += ch;
        mapping.push(i);
        lastWasSpace = false;
      }
    }

    return { normalized, mapping };
  }, [normalizeChar]);

  // Helper: collect text nodes and full text from a container
  const collectTextNodes = useCallback((doc: Document, container: Element) => {
    const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const textNodes: { node: Text; start: number; end: number }[] = [];
    let totalLength = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      const nodeLength = node.textContent?.length || 0;
      if (nodeLength > 0) {
        textNodes.push({ node, start: totalLength, end: totalLength + nodeLength });
        totalLength += nodeLength;
      }
    }

    const fullText = textNodes.map(tn => tn.node.textContent).join('');
    return { textNodes, fullText };
  }, []);

  // Helper: find ALL occurrences of a substring in text
  const findAllOccurrences = useCallback((text: string, search: string): number[] => {
    const indices: number[] = [];
    let pos = 0;
    while ((pos = text.indexOf(search, pos)) !== -1) {
      indices.push(pos);
      pos += 1; // Move past this char to find overlapping matches
    }
    return indices;
  }, []);

  // Helper: pick the best occurrence using position and context hints
  const pickBestMatch = useCallback((
    fullText: string,
    occurrences: number[],
    positionHint?: number,
    contextBefore?: string | null,
    contextAfter?: string | null,
  ): number => {
    if (occurrences.length === 1) return occurrences[0];

    let bestIndex = occurrences[0];
    let bestScore = -Infinity;

    for (const idx of occurrences) {
      let score = 0;

      // Score by proximity to stored position (most reliable)
      if (positionHint !== undefined && positionHint >= 0) {
        const distance = Math.abs(idx - positionHint);
        // Closer = higher score, max 100 points
        score += Math.max(0, 100 - distance);
      }

      // Score by context_before match
      if (contextBefore) {
        const normalizedContext = normalizeText(contextBefore);
        const textBefore = normalizeText(fullText.slice(Math.max(0, idx - contextBefore.length), idx));
        // Check how much of the context matches (suffix matching)
        let matchLen = 0;
        for (let i = 1; i <= Math.min(normalizedContext.length, textBefore.length); i++) {
          if (normalizedContext.slice(-i) === textBefore.slice(-i)) {
            matchLen = i;
          } else {
            break;
          }
        }
        score += matchLen * 2; // Context match weighted heavily
      }

      // Score by context_after match
      if (contextAfter) {
        const normalizedContext = normalizeText(contextAfter);
        const afterStart = idx + (contextAfter.length > 0 ? 1 : 0); // approximate
        const textAfter = normalizeText(fullText.slice(afterStart, afterStart + contextAfter.length));
        let matchLen = 0;
        for (let i = 1; i <= Math.min(normalizedContext.length, textAfter.length); i++) {
          if (normalizedContext.slice(0, i) === textAfter.slice(0, i)) {
            matchLen = i;
          } else {
            break;
          }
        }
        score += matchLen * 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = idx;
      }
    }

    return bestIndex;
  }, [normalizeText]);

  // Helper: wrap text nodes at a given range in mark elements
  const wrapTextRange = useCallback((
    doc: Document,
    textNodes: { node: Text; start: number; end: number }[],
    searchIndex: number,
    searchLength: number,
    highlightId: string | null,
    className: string,
    title: string
  ): boolean => {
    const searchEnd = searchIndex + searchLength;

    // Find which text nodes contain the match
    const affectedNodes: { node: Text; startInNode: number; endInNode: number }[] = [];

    for (const tn of textNodes) {
      if (tn.end <= searchIndex) continue;
      if (tn.start >= searchEnd) break;

      const startInNode = Math.max(0, searchIndex - tn.start);
      const endInNode = Math.min(tn.node.textContent?.length || 0, searchEnd - tn.start);

      affectedNodes.push({ node: tn.node, startInNode, endInNode });
    }

    if (affectedNodes.length === 0) return false;

    // Process nodes in reverse order to avoid index shifting
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
  }, []);

  const wrapReaderSegmentRange = useCallback(
    (
      doc: Document,
      textNodes: { node: Text; start: number; end: number }[],
      segment: ReaderSegment,
      isActive: boolean
    ): boolean => {
      const affectedNodes: { node: Text; startInNode: number; endInNode: number }[] = [];

      for (const textNode of textNodes) {
        if (textNode.end <= segment.startOffset) continue;
        if (textNode.start >= segment.endOffset) break;

        affectedNodes.push({
          node: textNode.node,
          startInNode: Math.max(0, segment.startOffset - textNode.start),
          endInNode: Math.min(
            textNode.node.textContent?.length || 0,
            segment.endOffset - textNode.start
          ),
        });
      }

      if (affectedNodes.length === 0) return false;

      for (let index = affectedNodes.length - 1; index >= 0; index -= 1) {
        const { node, startInNode, endInNode } = affectedNodes[index];
        const text = node.textContent || "";
        const before = text.slice(0, startInNode);
        const matched = text.slice(startInNode, endInNode);
        const after = text.slice(endInNode);

        const span = doc.createElement("span");
        span.className = [
          "reader-segment rounded-md px-1 py-0.5 transition-all duration-300",
          "cursor-pointer",
          isActive
            ? "bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-primary/20"
            : "text-foreground/60 hover:text-foreground/85",
        ].join(" ");
        span.setAttribute("data-reader-segment-id", segment.id);
        span.setAttribute("data-reader-segment-start", String(segment.startOffset));
        span.setAttribute("data-reader-segment-end", String(segment.endOffset));
        span.textContent = matched;

        const parent = node.parentNode;
        if (parent) {
          const fragment = doc.createDocumentFragment();
          if (before) fragment.appendChild(doc.createTextNode(before));
          fragment.appendChild(span);
          if (after) fragment.appendChild(doc.createTextNode(after));
          parent.replaceChild(fragment, node);
        }
      }

      return true;
    },
    []
  );

  // Main function: highlight text with positional disambiguation
  const highlightTextInDocument = useCallback((
    doc: Document,
    container: Element,
    searchText: string,
    highlightId: string | null,
    className: string,
    title: string = "",
    positionHint?: number,
    contextBefore?: string | null,
    contextAfter?: string | null,
  ): boolean => {
    if (!searchText) return false;

    const { textNodes, fullText } = collectTextNodes(doc, container);

    // Try 3 strategies in order:
    // 1. Exact match
    // 2. Character-normalized match (full-width/half-width)
    // 3. Whitespace-collapsed match (handles newlines vs spaces)

    // Strategy 1: Exact match
    let occurrences = findAllOccurrences(fullText, searchText);
    if (occurrences.length > 0) {
      const bestIndex = pickBestMatch(fullText, occurrences, positionHint, contextBefore, contextAfter);
      return wrapTextRange(doc, textNodes, bestIndex, searchText.length, highlightId, className, title);
    }

    // Strategy 2: Character-normalized match (no whitespace change)
    const normalizedFullText = normalizeText(fullText);
    const normalizedSearchText = normalizeText(searchText);
    occurrences = findAllOccurrences(normalizedFullText, normalizedSearchText);
    if (occurrences.length > 0) {
      const bestIndex = pickBestMatch(fullText, occurrences, positionHint, contextBefore, contextAfter);
      return wrapTextRange(doc, textNodes, bestIndex, searchText.length, highlightId, className, title);
    }

    // Strategy 3: Whitespace-collapsed match (handles \n\n vs space)
    const fullMapped = normalizeWithMapping(fullText);
    const searchMapped = normalizeWithMapping(searchText);

    occurrences = findAllOccurrences(fullMapped.normalized, searchMapped.normalized);
    if (occurrences.length > 0) {
      // Map normalized positions back to original positions
      const originalOccurrences = occurrences.map(idx => fullMapped.mapping[idx]);
      const bestOriginalIndex = pickBestMatch(fullText, originalOccurrences, positionHint, contextBefore, contextAfter);

      // Calculate the original length by mapping the end position
      const bestNormIdx = occurrences[originalOccurrences.indexOf(bestOriginalIndex)];
      const endNormIdx = bestNormIdx + searchMapped.normalized.length;
      const endOrigIdx = endNormIdx < fullMapped.mapping.length
        ? fullMapped.mapping[endNormIdx]
        : fullText.length;
      const originalLength = endOrigIdx - bestOriginalIndex;

      return wrapTextRange(doc, textNodes, bestOriginalIndex, originalLength, highlightId, className, title);
    }

    return false;
  }, [normalizeText, normalizeWithMapping, collectTextNodes, findAllOccurrences, pickBestMatch, wrapTextRange]);

  // Sanitize and apply highlights to HTML content (only on client)
  const processedBody = useMemo(() => {
    if (!isMounted) return "";

    // Prepend title as h1 so it's inside the selectable/highlightable area
    const titleHtml = content.title
      ? `<h1 id="article-title">${content.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>`
      : '';
    let html = DOMPurify.sanitize(titleHtml + content.body, {
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
      const hasTranslation = !!highlight.translation;
      const baseClass = hasTranslation
        ? "bg-green-100 dark:bg-green-400/50 cursor-pointer rounded transition-all duration-300"
        : "bg-yellow-200 dark:bg-yellow-300/50 cursor-pointer rounded transition-all duration-300";
      const focusClass = isFocused
        ? hasTranslation
          ? " ring-2 ring-primary ring-offset-2 bg-green-200 dark:bg-green-400/65"
          : " ring-2 ring-primary ring-offset-2 bg-yellow-300 dark:bg-yellow-300/65"
        : "";
      const title = highlight.note || highlight.translation || "";

      highlightTextInDocument(
        doc,
        container,
        highlight.selected_text || "",
        highlight.id,
        `${baseClass}${focusClass}`,
        title,
        parseInt(highlight.start_position, 10) || undefined,
        highlight.context_before,
        highlight.context_after
      );
    });

    // Apply current selection highlight
    if (currentSelection?.text) {
      highlightTextInDocument(
        doc,
        container,
        currentSelection.text,
        null,
        "bg-blue-100 dark:bg-blue-400/50 rounded",
        "",
        currentSelection.startOffset,
        currentSelection.contextBefore,
        currentSelection.contextAfter
      );
    }

    return container.innerHTML;
  }, [content.title, content.body, isMounted, highlights, focusedHighlightId, currentSelection, highlightTextInDocument]);

  const karaokePresentation = useMemo(() => {
    if (!isMounted || !isKaraokeMode || !processedBody) {
      return {
        html: processedBody,
        segments: [] as ReaderSegment[],
      };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${processedBody}</div>`, "text/html");
    const container = doc.body.firstElementChild;

    if (!container) {
      return {
        html: processedBody,
        segments: [] as ReaderSegment[],
      };
    }

    const { textNodes, fullText } = collectTextNodes(doc, container);
    const segments =
      readerSegments.length > 0
        ? readerSegments
        : buildReaderSegments(fullText, content.language);

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      wrapReaderSegmentRange(
        doc,
        textNodes,
        segments[index],
        segments[index].id === activeReaderSegmentId
      );
    }

    return {
      html: container.innerHTML,
      segments,
    };
  }, [
    activeReaderSegmentId,
    collectTextNodes,
    content.language,
    isKaraokeMode,
    isMounted,
    processedBody,
    readerSegments,
    wrapReaderSegmentRange,
  ]);

  const renderedBody = isKaraokeMode ? karaokePresentation.html : processedBody;

  useEffect(() => {
    onReaderSegmentsChange?.(isKaraokeMode ? karaokePresentation.segments : []);
  }, [isKaraokeMode, karaokePresentation.segments, onReaderSegmentsChange]);

  // Handle highlight clicks via event delegation
  useEffect(() => {
    if (!contentRef.current) return;

    const contentElement = contentRef.current;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const highlightTarget = target.closest("mark[data-highlight-id]") as HTMLElement | null;
      if (highlightTarget?.dataset.highlightId && onHighlightClick) {
        e.stopPropagation();
        const highlight = highlights.find((h) => h.id === highlightTarget.dataset.highlightId);
        if (highlight) {
          onHighlightClick(highlight);
        }
        return;
      }

      const segmentTarget = target.closest("[data-reader-segment-id]") as HTMLElement | null;
      if (segmentTarget?.dataset.readerSegmentId && onReaderSegmentSelect) {
        const segment = karaokePresentation.segments.find(
          (candidate) => candidate.id === segmentTarget.dataset.readerSegmentId
        );
        if (segment) {
          onReaderSegmentSelect(segment);
        }
      }
    };

    contentElement.addEventListener("click", handleClick);
    return () => contentElement.removeEventListener("click", handleClick);
  }, [highlights, karaokePresentation.segments, onHighlightClick, onReaderSegmentSelect]);

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

  useEffect(() => {
    if (!isKaraokeMode || !activeReaderSegmentId || !contentRef.current) return;

    const timeoutId = window.setTimeout(() => {
      const segment = contentRef.current?.querySelector(
        `[data-reader-segment-id="${activeReaderSegmentId}"]`
      );
      if (segment instanceof HTMLElement) {
        segment.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [activeReaderSegmentId, isKaraokeMode]);

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
        <h1 className="text-3xl font-bold leading-tight mb-4">{content.title}</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  const contentBody = (
    <div
      ref={contentRef}
      onMouseUp={() => {
        // Handle text selection for article content
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && contentRef.current) {
          const text = selection.toString().trim();
          if (text && onSelection) {
            const range = selection.getRangeAt(0);

            // Calculate offset relative to the FULL content container (not parent element)
            // This ensures stored positions match how highlightTextInDocument searches
            const walker = document.createTreeWalker(
              contentRef.current,
              NodeFilter.SHOW_TEXT,
              null
            );
            let startOffset = 0;
            let foundStart = false;
            let currentNode: Node | null;

            while ((currentNode = walker.nextNode())) {
              if (currentNode === range.startContainer) {
                startOffset += range.startOffset;
                foundStart = true;
                break;
              }
              startOffset += currentNode.textContent?.length || 0;
            }

            if (!foundStart) return;

            const endOffset = startOffset + text.length;
            const fullText = contentRef.current.textContent || "";

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
      dangerouslySetInnerHTML={{ __html: renderedBody }}
      className={
        "space-y-4 text-lg leading-relaxed [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6" +
        (isKaraokeMode
          ? " [&_.reader-segment]:mx-px [&_.reader-segment]:inline-decoration-clone [&_.reader-segment]:box-decoration-clone"
          : "")
      }
    />
  );

  if (hasSourceImage) {
    return (
      <div className="space-y-6">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <aside className="order-1 xl:order-none">
            <div className="xl:sticky xl:top-6">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                <Image
                  src={sourceImageUrl!}
                  alt={sourceImageAlt ?? content.title}
                  width={1400}
                  height={1800}
                  unoptimized
                  className="h-auto max-h-[78vh] w-full object-contain bg-muted/20"
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Original uploaded image
              </p>
            </div>
          </aside>
          <div className="order-2 min-w-0">{contentBody}</div>
        </div>
      </div>
    );
  }

  return <div className="space-y-6">{contentBody}</div>;
}
