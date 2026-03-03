"use client";

import { Highlight, TranslationLookup } from "@/types/database";
import { YourNotesPanel } from "./YourNotesPanel";
import { RecentLookupsPanel } from "./RecentLookupsPanel";
import { ReadingStats } from "./ReadingStats";
import { Separator } from "@/components/ui/separator";

interface RightSidebarProps {
  highlights: Highlight[];
  lookups: TranslationLookup[];
  flashcardTerms?: Set<string>;
  addingLookupId?: string | null;
  progress: number;
  wordsRead: number;
  totalWords: number;
  timeRemaining: string;
  isProgressInteractive?: boolean;
  onProgressSeek?: (percentage: number) => void;
  focusedHighlightId?: string | null;
  onHighlightClick?: (highlight: Highlight) => void;
  onDeleteHighlight?: (highlightId: string) => void;
  onLookupClick?: (lookup: TranslationLookup) => void;
  onAddLookupToFlashcards?: (lookup: TranslationLookup) => void;
  onClearLookups?: () => void;
  onRemoveLookup?: (id: string) => void;
}

export function RightSidebar({
  highlights,
  lookups,
  flashcardTerms,
  addingLookupId,
  progress,
  wordsRead,
  totalWords,
  timeRemaining,
  isProgressInteractive = false,
  onProgressSeek,
  focusedHighlightId,
  onHighlightClick,
  onDeleteHighlight,
  onLookupClick,
  onAddLookupToFlashcards,
  onClearLookups,
  onRemoveLookup,
}: RightSidebarProps) {
  return (
    <div className="h-full">
      {/* Reading Stats Section */}
      <ReadingStats
        progress={progress}
        wordsRead={wordsRead}
        totalWords={totalWords}
        timeRemaining={timeRemaining}
        isInteractive={isProgressInteractive}
        onSeek={onProgressSeek}
      />

      <Separator />

      {/* Your Notes Section */}
      <YourNotesPanel
        highlights={highlights}
        focusedHighlightId={focusedHighlightId}
        onHighlightClick={onHighlightClick}
        onDeleteHighlight={onDeleteHighlight}
      />

      <Separator />

      {/* Recent Lookups Section */}
      <RecentLookupsPanel
        lookups={lookups}
        flashcardTerms={flashcardTerms}
        addingLookupId={addingLookupId}
        onLookupClick={onLookupClick}
        onAddToFlashcards={onAddLookupToFlashcards}
        onClear={onClearLookups}
        onRemove={onRemoveLookup}
      />
    </div>
  );
}
