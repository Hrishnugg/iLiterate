"use client";

import { TranslationLookup } from "@/types/database";
import { cn } from "@/lib/utils";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecentLookupsPanelProps {
  lookups: TranslationLookup[];
  onLookupClick?: (lookup: TranslationLookup) => void;
  onClear?: () => void;
  onRemove?: (id: string) => void;
  className?: string;
}

export function RecentLookupsPanel({
  lookups,
  onLookupClick,
  onClear,
  onRemove,
  className,
}: RecentLookupsPanelProps) {
  // Show last 15 lookups
  const recentLookups = lookups.slice(0, 15);

  if (recentLookups.length === 0) {
    return (
      <div className={cn("p-4", className)}>
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Recent Lookups
        </h3>
        <p className="text-sm text-muted-foreground">
          Words and phrases you translate will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Recent Lookups ({lookups.length})
        </h3>
        {onClear && lookups.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-auto py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {recentLookups.map((lookup, index) => (
          <div
            key={lookup.id}
            className="group relative flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-accent"
          >
            <button
              onClick={() => onLookupClick?.(lookup)}
              className="flex-1 text-left"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground w-4">
                  {index + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {lookup.source_text}
                  </p>
                  <p className="text-sm text-primary">
                    → {lookup.translated_text}
                  </p>
                  {lookup.transliteration && (
                    <p className="text-xs text-muted-foreground">
                      {lookup.transliteration}
                    </p>
                  )}
                </div>
              </div>
            </button>

            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(lookup.id)}
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
