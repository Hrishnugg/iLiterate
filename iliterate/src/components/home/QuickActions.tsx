"use client";

import Link from "next/link";
import { Plus, BookOpen, ClipboardCheck } from "lucide-react";

const actions = [
  { label: "New Flashcard", href: "/create", icon: Plus },
  { label: "Browse Library", href: "/library", icon: BookOpen },
  { label: "Take a Quiz", href: "/quizzes", icon: ClipboardCheck },
];

export function QuickActions() {
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card p-6">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Quick Actions
      </span>
      <div className="mt-3 flex flex-col gap-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <action.icon className="size-3.5 text-muted-foreground" />
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
