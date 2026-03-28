"use client";

import Link from "next/link";
import { Plus, BookOpen, ClipboardCheck } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

export function QuickActions() {
  const t = useT();

  const actions = [
    { labelKey: "home.newFlashcard", href: "/create", icon: Plus },
    { labelKey: "home.browseLibrary", href: "/library", icon: BookOpen },
    { labelKey: "home.takeQuiz", href: "/quizzes", icon: ClipboardCheck },
  ];

  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card p-6">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("home.quickActions")}
      </span>
      <div className="mt-3 flex flex-col gap-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <action.icon className="size-3.5 text-muted-foreground" />
            {t(action.labelKey)}
          </Link>
        ))}
      </div>
    </div>
  );
}
