"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, MessageSquare, Languages, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { TextSelection } from "./TextHighlighter";

interface TranslationResult {
  translation: string;
  transliteration?: string;
  partOfSpeech?: string;
  definitions?: string[];
  examples?: string[];
}

interface TranslatePopoverProps {
  selection: TextSelection;
  position: { x: number; y: number; bottom: number };
  onTranslate: (text: string) => Promise<TranslationResult>;
  onAddNote: (text: string, note: string, translation?: TranslationResult) => void;
  onSaveWord: (text: string, translation: TranslationResult) => void;
  onClose: () => void;
}

export function TranslatePopover({
  selection,
  position,
  onTranslate,
  onAddNote,
  onSaveWord,
  onClose,
}: TranslatePopoverProps) {
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");
  const [alsoAddFlashcard, setAlsoAddFlashcard] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ left: number; top: number; placeBelow: boolean } | null>(null);

  const handleTranslate = async () => {
    setLoading(true);
    try {
      const result = await onTranslate(selection.text);
      setTranslation(result);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = () => {
    if (note.trim()) {
      onAddNote(selection.text, note.trim(), translation || undefined);
      // Also add to flashcards if checkbox is checked and we have a translation
      if (alsoAddFlashcard && translation) {
        onSaveWord(selection.text, translation);
      }
      onClose();
    }
  };

  const handleSaveWord = () => {
    if (translation) {
      onSaveWord(selection.text, translation);
    }
  };

  // Close when clicking outside the popover
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Recalculate position whenever popover content changes
  const updatePosition = useCallback(() => {
    if (!popoverRef.current) return;

    const popoverRect = popoverRef.current.getBoundingClientRect();
    const popoverHeight = popoverRect.height;
    const popoverWidth = popoverRef.current.offsetWidth || 380;
    const padding = 12;

    // Horizontal: keep within viewport
    let left = position.x - popoverWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - popoverWidth - padding));

    // Use actual selection bounds: position.y = top of selection, position.bottom = bottom of selection
    const selTop = position.y;
    const selBottom = position.bottom;
    const spaceAbove = selTop;
    const spaceBelow = window.innerHeight - selBottom;

    let top: number;
    let placeBelow: boolean;

    if (spaceBelow >= popoverHeight + padding) {
      // Fits below the lowest line of the selection
      top = selBottom + padding;
      placeBelow = true;
    } else if (spaceAbove >= popoverHeight + padding) {
      // Fits above the highest line of the selection
      top = selTop - popoverHeight - padding;
      placeBelow = false;
    } else {
      // Doesn't fit either way - place where there's more room
      if (spaceBelow >= spaceAbove) {
        top = selBottom + padding;
        placeBelow = true;
      } else {
        top = Math.max(padding, selTop - popoverHeight - padding);
        placeBelow = false;
      }
    }

    setAdjustedPos({ left, top, placeBelow });
  }, [position.x, position.y, position.bottom]);

  // Update position on mount and whenever content changes
  useEffect(() => {
    // Use RAF to ensure DOM has been painted
    const rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [updatePosition, translation, loading, showNoteInput]);

  // Calculate max height based on available space, capped at 500px
  const maxHeight = adjustedPos
    ? adjustedPos.placeBelow
      ? window.innerHeight - adjustedPos.top - 12
      : position.y - 12
    : 500;

  const popupStyle: React.CSSProperties = {
    position: "fixed",
    left: adjustedPos?.left ?? Math.min(position.x - 190, window.innerWidth - 392),
    top: adjustedPos?.top ?? (position.bottom + 12),
    zIndex: 50,
    maxHeight: Math.min(maxHeight, 500),
  };

  const originY = adjustedPos?.placeBelow === false ? 1 : 0;

  return (
    <motion.div
      ref={popoverRef}
      className="w-[24rem] max-w-[calc(100vw-24px)] flex flex-col"
      initial={{ opacity: 0, scale: 0.92, y: adjustedPos?.placeBelow === false ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: adjustedPos?.placeBelow === false ? 6 : -6 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={{ ...popupStyle, transformOrigin: `50% ${originY * 100}%` }}
    >
      <div className="rounded-lg border bg-popover shadow-lg relative flex flex-col overflow-hidden" style={{ maxHeight: 'inherit' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-10 cursor-pointer rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Scrollable content area - scrollbar only on hover */}
        <div className="overflow-y-auto p-3 popover-scroll">
          {/* Selected text preview */}
          <div className="mb-3 border-b pb-2 pr-6">
            <p className="text-sm font-medium text-foreground break-words">
              &ldquo;{selection.text.length > 100 ? selection.text.slice(0, 100) + "..." : selection.text}&rdquo;
            </p>
          </div>

          {/* Action buttons */}
          {!translation && !loading && !showNoteInput && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleTranslate}
                className="flex-1 cursor-pointer"
              >
                <Languages className="mr-1.5 h-3.5 w-3.5" />
                Translate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNoteInput(true)}
                className="cursor-pointer"
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                Note
              </Button>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Translation result */}
          {translation && !showNoteInput && (
            <div className="space-y-3">
              <div>
                <p className="text-base font-medium text-primary">
                  {translation.translation}
                </p>
                {translation.transliteration && (
                  <p className="text-sm text-muted-foreground">
                    {translation.transliteration}
                  </p>
                )}
                {translation.partOfSpeech && (
                  <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {translation.partOfSpeech}
                  </span>
                )}
              </div>

              {translation.definitions && translation.definitions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Definitions
                  </p>
                  <ul className="space-y-1">
                    {translation.definitions.map((def, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {def}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNoteInput(true)}
                  className="cursor-pointer"
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  Add Note
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveWord}
                  className="cursor-pointer"
                >
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  Save Word
                </Button>
              </div>
            </div>
          )}

          {/* Note input */}
          {showNoteInput && (
            <div className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this..."
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring"
                )}
                rows={3}
                autoFocus
              />
              {translation && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={alsoAddFlashcard}
                    onCheckedChange={(checked) => setAlsoAddFlashcard(checked === true)}
                  />
                  Also add to flashcards
                </label>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!note.trim()}
                  className="cursor-pointer"
                >
                  Save Note
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNoteInput(false);
                    setNote("");
                  }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
