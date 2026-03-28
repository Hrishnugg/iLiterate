"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

interface ActiveLesson {
  id: string;
  title: string;
  topic: string;
  status: string;
  progress_percent?: number;
}

export function HeroTile({ lesson }: { lesson: ActiveLesson | null }) {
  const t = useT();

  if (lesson) {
    return (
      <Link
        href={`/lesson-plan/${lesson.id}`}
        className="group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-card p-8 transition-colors hover:bg-accent/50"
        style={{ gridColumn: "span 2" }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("home.continueLesson")}
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {lesson.title}
          </h2>
          <span className="text-sm text-muted-foreground">{lesson.topic}</span>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t("home.readingProgress")}
            </span>
            <span className="font-mono text-xs font-medium">
              {lesson.progress_percent ?? 0}%
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${lesson.progress_percent ?? 0}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-primary">
            {t("home.continueReading")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    );
  }

  // No active lesson — show CTA
  return (
    <Link
      href="/lesson-plan"
      className="group relative flex flex-col items-center justify-center overflow-hidden rounded-lg border bg-card p-8 text-center transition-colors hover:bg-accent/50"
      style={{ gridColumn: "span 2" }}
    >
      <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <GraduationCap className="size-7" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">
        {t("home.startLesson")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("home.startLessonDesc")}
      </p>
      <div className="mt-6 flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors group-hover:bg-primary/90">
        <Plus className="size-4" />
        {t("home.newLesson")}
      </div>
    </Link>
  );
}
