"use client";

import Image from "next/image";
import { LeaderboardEntry } from "@/types/database";
import { useT } from "@/lib/i18n/I18nProvider";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
  emptyMessage?: React.ReactNode;
}

function getRankStyle(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-yellow-50 dark:bg-transparent border-yellow-300 dark:border-yellow-700/30";
    case 2:
      return "bg-gray-50 dark:bg-transparent border-gray-300 dark:border-gray-600/30";
    case 3:
      return "bg-orange-50 dark:bg-transparent border-orange-300 dark:border-orange-700/30";
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
  const t = useT();
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage ?? t("leaderboard.noActivity")}
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
            <div className="relative flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted overflow-hidden">
                {entry.avatarUrl ? (
                  <Image
                    src={entry.avatarUrl}
                    alt={entry.displayName}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">
                    {entry.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {emoji && (
                <span className="absolute -bottom-1 -right-1 text-sm leading-none select-none">
                  {emoji}
                </span>
              )}
              {!emoji && (
                <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-0.5 text-[10px] font-bold leading-none text-muted-foreground ring-1 ring-background">
                  {getRankLabel(entry.rank)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {entry.displayName}
                {isCurrentUser && (
                  <span className="ml-2 text-xs text-primary font-normal">({t("leaderboard.you")})</span>
                )}
              </p>
            </div>
            <div className="text-right font-semibold tabular-nums">
              {entry.points.toLocaleString()} {t("leaderboard.pts")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
