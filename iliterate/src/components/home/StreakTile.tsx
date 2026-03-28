"use client";

import { Flame } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

export function StreakTile({ days }: { days: number }) {
  const t = useT();
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-amber-500" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("home.streak")}
        </span>
      </div>
      <div className="mt-3">
        <span className="font-mono text-4xl font-semibold tracking-tight">
          {days}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          {days === 1 ? t("home.dayInRow") : t("home.daysInRow")}
        </p>
      </div>
    </div>
  );
}
