"use client";

import { useEffect, useState } from "react";
import { HeroTile } from "@/components/home/HeroTile";
import { LevelTile } from "@/components/home/LevelTile";
import { FlashcardDueTile } from "@/components/home/FlashcardDueTile";
import { StreakTile } from "@/components/home/StreakTile";
import { QuickActions } from "@/components/home/QuickActions";
import { RecentActivityBand } from "@/components/home/RecentActivityBand";

interface DashboardData {
  activeLesson: {
    id: string;
    title: string;
    topic: string;
    status: string;
    progress_percent?: number;
  } | null;
  level: number;
  cefr: string;
  language: string;
  xpProgress: number;
  dueFlashcards: number;
  streakDays: number;
  recentActivity: {
    id: string;
    title: string;
    type: "lesson" | "flashcards" | "quiz";
    detail: string;
    xp: number;
  }[];
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [progressRes, flashcardRes, lessonRes, streakRes] = await Promise.allSettled([
          fetch("/api/progress"),
          fetch("/api/vocabulary/review"),
          fetch("/api/lesson/history?limit=5"),
          fetch("/api/streak"),
        ]);

        let level = 1;
        let cefr = "A1";
        let language = "Japanese";
        let xpProgress = 0;

        if (progressRes.status === "fulfilled" && progressRes.value.ok) {
          const progress = await progressRes.value.json();
          if (progress?.progressInfo?.overall) {
            level = progress.progressInfo.overall.level ?? 1;
            cefr = progress.progressInfo.overall.cefr ?? "A1";
            xpProgress = progress.progressInfo.overall.progress ?? 0;
          }
          if (progress?.targetLanguage) {
            language = progress.targetLanguage;
          }
        }

        let dueFlashcards = 0;
        if (flashcardRes.status === "fulfilled" && flashcardRes.value.ok) {
          const flashcards = await flashcardRes.value.json();
          dueFlashcards = flashcards?.totalDue ?? 0;
        }

        let streakDays = 0;
        if (streakRes.status === "fulfilled" && streakRes.value.ok) {
          const streak = await streakRes.value.json();
          streakDays = streak?.currentStreak ?? 0;
        }

        let activeLesson = null;
        const recentActivity: DashboardData["recentActivity"] = [];
        if (lessonRes.status === "fulfilled" && lessonRes.value.ok) {
          const lessons = await lessonRes.value.json();
          if (Array.isArray(lessons)) {
            const inProgress = lessons.find(
              (l: { status: string }) => l.status === "reading" || l.status === "quiz"
            );
            if (inProgress) {
              activeLesson = {
                id: inProgress.id,
                title: inProgress.title ?? "Untitled Lesson",
                topic: inProgress.topic ?? "",
                status: inProgress.status,
                progress_percent: inProgress.progress_percent ?? 0,
              };
            }
            for (const lesson of lessons.slice(0, 3)) {
              if (lesson.status === "completed") {
                recentActivity.push({
                  id: lesson.id,
                  title: lesson.title ?? "Lesson",
                  type: "lesson",
                  detail: `Score ${lesson.quiz_score ?? 0}%`,
                  xp: lesson.total_xp ?? 0,
                });
              }
            }
          }
        }

        setData({
          activeLesson,
          level,
          cefr,
          language,
          xpProgress,
          dueFlashcards,
          streakDays,
          recentActivity,
        });
      } catch {
        // Fail gracefully with defaults
        setData({
          activeLesson: null,
          level: 1,
          cefr: "A1",
          language: "Japanese",
          xpProgress: 0,
          dueFlashcards: 0,
          streakDays: 0,
          recentActivity: [],
        });
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-52 animate-pulse rounded-lg bg-muted" />
          <div className="h-52 animate-pulse rounded-lg bg-muted" />
          <div className="h-36 animate-pulse rounded-lg bg-muted" />
          <div className="h-36 animate-pulse rounded-lg bg-muted" />
          <div className="h-36 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="flex flex-col gap-8">
      {/* Page heading — lives in content now, not header bar */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Home</h1>
        <p className="mt-1 text-muted-foreground">
          Pick up where you left off, or start something new.
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Row 1: Hero (2 cols) + Level (1 col) */}
        <HeroTile lesson={d.activeLesson} />
        <LevelTile
          level={d.level}
          cefr={d.cefr}
          language={d.language}
          xpProgress={d.xpProgress}
        />

        {/* Row 2: Flashcard Due + Streak + Quick Actions */}
        <FlashcardDueTile dueCount={d.dueFlashcards} />
        <StreakTile days={d.streakDays} />
        <QuickActions />

        {/* Row 3: Recent Activity (full width) */}
        <RecentActivityBand items={d.recentActivity} />
      </div>
    </div>
  );
}
