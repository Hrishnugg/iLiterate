"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { Content } from "@/types/database";
import { TextSelection } from "./TextHighlighter";
import { PDFRenderer } from "./PDFRenderer";
import { EPUBRenderer } from "./EPUBRenderer";

interface ContentRendererProps {
  content: Content;
  onSelection?: (selection: TextSelection | null) => void;
  onTocUpdate?: (toc: Array<{ label: string; href: string }>) => void;
}

export function ContentRenderer({
  content,
  onSelection,
  onTocUpdate,
}: ContentRendererProps) {
  // Determine content type from source_url or content_type
  const isPDF =
    content.source_url?.toLowerCase().endsWith(".pdf") ||
    content.content_type === "pdf";
  const isEPUB =
    content.source_url?.toLowerCase().endsWith(".epub") ||
    content.content_type === "epub";

  // Sanitize HTML content to prevent XSS attacks
  const sanitizedBody = useMemo(() => {
    if (typeof window === "undefined") {
      // Server-side: return empty string (will be hydrated on client)
      return "";
    }
    return DOMPurify.sanitize(content.body, {
      ALLOWED_TAGS: [
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p", "br", "hr",
        "ul", "ol", "li",
        "blockquote", "pre", "code",
        "strong", "em", "b", "i", "u", "s",
        "a", "span", "div",
        "table", "thead", "tbody", "tr", "th", "td",
        "img", "figure", "figcaption",
      ],
      ALLOWED_ATTR: [
        "href", "target", "rel",
        "src", "alt", "title",
        "class", "id",
        "colspan", "rowspan",
      ],
      ALLOW_DATA_ATTR: false,
    });
  }, [content.body]);

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
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold leading-tight">{content.title}</h1>
      <div
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
        dangerouslySetInnerHTML={{ __html: sanitizedBody }}
        className="space-y-4 text-lg leading-relaxed [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic"
      />
    </div>
  );
}
