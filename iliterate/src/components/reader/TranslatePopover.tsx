"use client";

import { useState } from "react";
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

  // Position popup above selection if near bottom, otherwise below
  const popupStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(position.x, window.innerWidth - 300),
    top: position.y > 200 ? position.y - 10 : position.y + 30,
    transform: position.y > 200 ? "translateY(-100%)" : "none",
    zIndex: 50,
  };

  return (
    <div style={popupStyle} className="w-72">
      <div className="rounded-lg border bg-popover p-3 shadow-lg relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Selected text preview */}
        <div className="mb-3 border-b pb-2 pr-6">
          <p className="text-sm font-medium text-foreground">
            &ldquo;{selection.text}&rdquo;
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
  );
}
