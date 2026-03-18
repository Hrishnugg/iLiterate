"use client";

import Link from "next/link";
import { Layers } from "lucide-react";

export function FlashcardDueTile({ dueCount }: { dueCount: number }) {
  return (
    <Link
      href="/flashcards"
      className="group flex flex-col justify-between rounded-lg border bg-card p-6 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Due Today
        </span>
      </div>
      <div className="mt-3">
        <span className="font-mono text-4xl font-semibold tracking-tight">
          {dueCount}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          {dueCount === 0 ? "All caught up" : "flashcards to review"}
        </p>
      </div>
    </Link>
  );
}
