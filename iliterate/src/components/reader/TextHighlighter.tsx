"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  contextBefore: string;
  contextAfter: string;
  range: Range;
}

interface TextHighlighterProps {
  children: React.ReactNode;
  onSelection?: (selection: TextSelection | null) => void;
  className?: string;
  contentId?: string;
}

export function TextHighlighter({
  children,
  onSelection,
  className,
  contentId,
}: TextHighlighterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Get full text content and calculate offset
  const getTextOffset = useCallback((node: Node, offset: number): number => {
    if (!containerRef.current) return 0;

    const walker = document.createTreeWalker(
      containerRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let currentNode;

    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return currentOffset + offset;
      }
      currentOffset += currentNode.textContent?.length || 0;
    }

    return 0;
  }, []);

  // Get context around selection
  const getContext = useCallback((fullText: string, start: number, end: number) => {
    const contextLength = 50;
    const contextBefore = fullText.slice(Math.max(0, start - contextLength), start);
    const contextAfter = fullText.slice(end, Math.min(fullText.length, end + contextLength));
    return { contextBefore, contextAfter };
  }, []);

  // Handle selection change
  const handleSelectionChange = useCallback(() => {
    if (!containerRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      onSelection?.(null);
      return;
    }

    const range = selection.getRangeAt(0);

    // Check if selection is within our container
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      onSelection?.(null);
      return;
    }

    // Get selected text
    const text = selection.toString().trim();
    if (text.length === 0) {
      onSelection?.(null);
      return;
    }

    // Calculate offsets
    const startOffset = getTextOffset(range.startContainer, range.startOffset);
    const endOffset = getTextOffset(range.endContainer, range.endOffset);

    // Get full text for context
    const fullText = containerRef.current.textContent || "";
    const { contextBefore, contextAfter } = getContext(fullText, startOffset, endOffset);

    onSelection?.({
      text,
      startOffset,
      endOffset,
      contextBefore,
      contextAfter,
      range: range.cloneRange(),
    });
  }, [getTextOffset, getContext, onSelection]);

  // Mouse events for selection detection
  const handleMouseDown = useCallback(() => {
    setIsSelecting(true);
    onSelection?.(null);
  }, [onSelection]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
    // Small delay to let selection finalize
    setTimeout(handleSelectionChange, 10);
  }, [handleSelectionChange]);

  // Clear selection when clicking outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onSelection?.(null);
        window.getSelection()?.removeAllRanges();
      }
    },
    [onSelection]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={cn(
        "relative select-text",
        isSelecting && "cursor-text",
        className
      )}
      data-content-id={contentId}
    >
      {children}
    </div>
  );
}

// Utility to restore a highlight from saved position
export function createHighlightSpan(
  container: HTMLElement,
  startOffset: number,
  endOffset: number,
  className?: string
): HTMLSpanElement | null {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentOffset = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;
  let node: Node | null;

  // Find start and end nodes
  while ((node = walker.nextNode()) !== null) {
    const textNode = node as Text;
    const nodeLength = textNode.textContent?.length || 0;

    if (!startNode && currentOffset + nodeLength > startOffset) {
      startNode = textNode;
      startNodeOffset = startOffset - currentOffset;
    }

    if (!endNode && currentOffset + nodeLength >= endOffset) {
      endNode = textNode;
      endNodeOffset = endOffset - currentOffset;
      break;
    }

    currentOffset += nodeLength;
  }

  if (!startNode || !endNode) return null;

  // Create range and wrap in span
  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);

  const span = document.createElement("span");
  span.className = className || "bg-yellow-200/50";
  try {
    range.surroundContents(span);
    return span;
  } catch {
    // Complex selection crossing elements - skip for now
    return null;
  }
}
