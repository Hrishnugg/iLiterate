"use client";

import { Highlight, TranslationLookup } from "@/types/database";
import { YourNotesPanel } from "./YourNotesPanel";
import { RecentLookupsPanel } from "./RecentLookupsPanel";
import { ReadingStats } from "./ReadingStats";
import { Separator } from "@/components/ui/separator";

interface RightSidebarProps {
  highlights: Highlight[];
  lookups: TranslationLookup[];
  progress: number;
  wordsRead: number;
  totalWords: number;
  timeRemaining: string;
  onHighlightClick?: (highlight: Highlight) => void;
  onLookupClick?: (lookup: TranslationLookup) => void;
  onClearLookups?: () => void;
  onRemoveLookup?: (id: string) => void;
}

export function RightSidebar({
  highlights,
  lookups,
  progress,
  wordsRead,
  totalWords,
  timeRemaining,
  onHighlightClick,
  onLookupClick,
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
      />

      <Separator />

      {/* Your Notes Section */}
      <YourNotesPanel
        highlights={highlights}
        onHighlightClick={onHighlightClick}
      />

      <Separator />

      {/* Recent Lookups Section */}
      <RecentLookupsPanel
        lookups={lookups}
        onLookupClick={onLookupClick}
        onClear={onClearLookups}
        onRemove={onRemoveLookup}
      />
    </div>
  );
}
