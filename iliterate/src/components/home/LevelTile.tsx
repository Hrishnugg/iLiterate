"use client";

import { useT } from "@/lib/i18n/I18nProvider";

interface LevelTileProps {
  level: number;
  cefr: string;
  language: string;
  xpProgress: number; // 0–100
}

export function LevelTile({ level, cefr, language, xpProgress }: LevelTileProps) {
  const t = useT();
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card p-8">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("home.currentLevel")}
      </span>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="font-mono text-7xl font-bold tracking-tighter text-primary">
          {cefr}
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">
          {t(`library.languages.${language.toLowerCase()}` as Parameters<typeof t>[0]) || language}
        </span>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary/60 transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {t("home.percentToNextLevel").replace("{percent}", String(xpProgress))}
        </span>
      </div>
    </div>
  );
}
