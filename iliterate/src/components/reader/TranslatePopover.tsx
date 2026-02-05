"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, MessageSquare, Languages, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  position: { x: number; y: number };
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
      onClose();
    }
  };

  const handleSaveWord = () => {
    if (translation) {
      onSaveWord(selection.text, translation);
    }
  };

  // Recalculate position whenever popover content changes
  const updatePosition = useCallback(() => {
    if (!popoverRef.current) return;

    const popoverRect = popoverRef.current.getBoundingClientRect();
    const popoverHeight = popoverRect.height;
    const popoverWidth = 320; // w-80 = 20rem = 320px
    const padding = 12;

    // Horizontal: keep within viewport
    let left = position.x - popoverWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - popoverWidth - padding));

    // Vertical: prefer above selection, fall back to below
    const spaceAbove = position.y;
    const spaceBelow = window.innerHeight - position.y - 30; // 30px for selection height estimate

    let top: number;
    let placeBelow: boolean;

    if (spaceAbove >= popoverHeight + padding) {
      // Fits above
      top = position.y - popoverHeight - padding;
      placeBelow = false;
    } else if (spaceBelow >= popoverHeight + padding) {
      // Fits below
      top = position.y + 30;
      placeBelow = true;
    } else {
      // Doesn't fit either way - place where there's more room and constrain height
      if (spaceAbove > spaceBelow) {
        top = Math.max(padding, position.y - popoverHeight - padding);
        placeBelow = false;
      } else {
        top = position.y + 30;
        placeBelow = true;
      }
    }

    setAdjustedPos({ left, top, placeBelow });
  }, [position.x, position.y]);

  // Update position on mount and whenever content changes
  useEffect(() => {
    // Use RAF to ensure DOM has been painted
    const rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [updatePosition, translation, loading, showNoteInput]);

  // Calculate max height based on available space
  const maxHeight = adjustedPos
    ? adjustedPos.placeBelow
      ? window.innerHeight - adjustedPos.top - 12
      : position.y - 12
    : 400;

  const popupStyle: React.CSSProperties = {
    position: "fixed",
    left: adjustedPos?.left ?? Math.min(position.x - 144, window.innerWidth - 300),
    top: adjustedPos?.top ?? (position.y > 200 ? position.y - 10 : position.y + 30),
    zIndex: 50,
    maxHeight: Math.min(maxHeight, 400),
  };

  return (
    <div ref={popoverRef} style={popupStyle} className="w-80 flex flex-col">
      <div className="rounded-lg border bg-popover shadow-lg relative flex flex-col overflow-hidden" style={{ maxHeight: 'inherit' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                className="flex-1"
              >
                <Languages className="mr-1.5 h-3.5 w-3.5" />
                Translate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNoteInput(true)}
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
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  Add Note
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveWord}
                >
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  Save Word
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClose}
                >
                  Close
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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!note.trim()}
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
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
