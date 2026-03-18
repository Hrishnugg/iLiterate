"use client";

import { LeaderboardEntry } from "@/types/database";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
  emptyMessage?: React.ReactNode;
}

function getRankStyle(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700";
    case 2:
      return "bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600";
    case 3:
      return "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700";
    default:
      return "";
  }
}

function getRankLabel(rank: number): string {
  switch (rank) {
    case 1:
      return "1st";
    case 2:
      return "2nd";
    case 3:
      return "3rd";
    default:
      return `${rank}`;
  }
}

function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return "\u{1F947}";
    case 2:
      return "\u{1F948}";
    case 3:
      return "\u{1F949}";
    default:
      return "";
  }
}

export function LeaderboardTable({ entries, currentUserId, emptyMessage }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage ?? "No activity this period yet. Complete quizzes, readings, or flashcard reviews to earn points!"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const isCurrentUser = entry.userId === currentUserId;
        const rankStyle = getRankStyle(entry.rank);
        const emoji = getRankEmoji(entry.rank);

        return (
          <div
            key={entry.userId}
            className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${rankStyle} ${
              isCurrentUser ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-bold text-sm">
              {emoji || getRankLabel(entry.rank)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {entry.displayName}
                {isCurrentUser && (
                  <span className="ml-2 text-xs text-primary font-normal">(you)</span>
                )}
              </p>
            </div>
            <div className="text-right font-semibold tabular-nums">
              {entry.points.toLocaleString()} pts
            </div>
          </div>
        );
      })}
    </div>
  );
}
