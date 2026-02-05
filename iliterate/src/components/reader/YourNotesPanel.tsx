"use client";

import { Highlight } from "@/types/database";
import { cn } from "@/lib/utils";
import { StickyNote, MessageSquare, Trash2 } from "lucide-react";

interface YourNotesPanelProps {
  highlights: Highlight[];
  focusedHighlightId?: string | null;
  onHighlightClick?: (highlight: Highlight) => void;
  onDeleteHighlight?: (highlightId: string) => void;
  className?: string;
}

export function YourNotesPanel({
  highlights,
  focusedHighlightId,
  onHighlightClick,
  onDeleteHighlight,
  className,
}: YourNotesPanelProps) {
  // Filter highlights that have notes or translations
  const notes = highlights.filter(
    (h) => h.note || h.translation
  );

  if (notes.length === 0) {
    return (
      <div className={cn("p-4", className)}>
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <StickyNote className="h-3.5 w-3.5" />
          Your Notes
        </h3>
        <p className="text-sm text-muted-foreground">
          Select text and add notes or translations. They&apos;ll appear here.
        </p>
      </div>
    );
  }

  // Group by paragraph/section (using context_before as a rough grouping key)
  const groupedNotes = groupHighlightsByContext(notes);

  return (
    <div className={cn("p-4", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" />
        Your Notes ({notes.length})
      </h3>
      <div className="space-y-4">
        {groupedNotes.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-2">
            {groupIndex > 0 && (
              <div className="my-3 border-t" />
            )}
            {group.map((highlight) => {
              const isFocused = highlight.id === focusedHighlightId;
              const hasTranslation = !!highlight.translation;
              return (
              <div
                key={highlight.id}
                className="relative group/note"
                data-sidebar-highlight={highlight.id}
              >
                <button
                  onClick={() => onHighlightClick?.(highlight)}
                  className="w-full text-left"
                >
                  <div className={cn(
                    "rounded-md border bg-card p-3 pr-8 transition-all",
                    isFocused
                      ? hasTranslation
                        ? "ring-2 ring-primary ring-offset-2 bg-green-50 dark:bg-green-900/20"
                        : "ring-2 ring-primary ring-offset-2 bg-yellow-50 dark:bg-yellow-900/20"
                      : "hover:bg-accent",
                    hasTranslation && "border-l-2 border-l-green-400 dark:border-l-green-600"
                  )}>
                    {/* Selected text */}
                    <p className="mb-2 text-sm font-medium text-foreground">
                      &ldquo;{truncate(highlight.selected_text, 60)}&rdquo;
                    </p>

                    {/* Translation */}
                    {highlight.translation && (
                      <p className="mb-2 text-sm text-primary">
                        → {highlight.translation}
                        {highlight.transliteration && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({highlight.transliteration})
                          </span>
                        )}
                      </p>
                    )}

                    {/* User note */}
                    {highlight.note && (
                      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        {highlight.note}
                      </p>
                    )}

                    {/* Part of speech tag */}
                    {highlight.part_of_speech && (
                      <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {highlight.part_of_speech}
                      </span>
                    )}
                  </div>
                </button>
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteHighlight?.(highlight.id);
                  }}
                  className="absolute right-2 top-2 rounded-sm p-1 opacity-0 transition-opacity group-hover/note:opacity-70 hover:!opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete highlight"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Group highlights that appear near each other
function groupHighlightsByContext(highlights: Highlight[]): Highlight[][] {
  if (highlights.length === 0) return [];
  
  // Sort by position
  const sorted = [...highlights].sort((a, b) => {
    const aPos = parseInt(a.start_position, 10) || 0;
    const bPos = parseInt(b.start_position, 10) || 0;
    return aPos - bPos;
  });

  const groups: Highlight[][] = [];
  let currentGroup: Highlight[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevPos = parseInt(prev.start_position, 10) || 0;
    const currPos = parseInt(curr.start_position, 10) || 0;

    // Group if within 500 characters (rough heuristic)
    if (currPos - prevPos < 500) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  return groups;
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
