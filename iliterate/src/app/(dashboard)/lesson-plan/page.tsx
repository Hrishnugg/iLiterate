"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowRight,
  Globe,
  UtensilsCrossed,
  Home,
  Landmark,
  Briefcase,
  Newspaper,
  TreePine,
  Monitor,
  Users,
  Heart,
  Film,
  BookOpen,
} from "lucide-react";
import { numericLevelToCEFR } from "@/types/database";
import { DowngradeLevelDialog } from "@/components/lesson/DowngradeLevelDialog";
import { cn } from "@/lib/utils";

interface TopicInfo {
  id: string;
  name: string;
  icon: string;
}

interface LessonHistoryItem {
  id: string;
  title: string;
  topic: TopicInfo;
  targetLevel: number;
  length: string;
  wordCount: number;
  status: "reading" | "quiz" | "completed";
  quizScore: number | null;
  quizMaxScore: number | null;
  percentage: number | null;
  levelAdjustment: number | null;
  readingXpAwarded: number | null;
  vocabularyXpAwarded: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface LessonData {
  id: string;
  title: string;
  body: string;
  targetLevel: number;
  topic: TopicInfo;
  length: string;
  wordCount: number;
  vocabulary: Array<{ word: string; translation: string; context: string }>;
  status: "reading" | "quiz" | "completed";
  createdAt: string;
}

const TOPICS = [
  { id: "travel", name: "Travel", Icon: Globe },
  { id: "food", name: "Food", Icon: UtensilsCrossed },
  { id: "daily_life", name: "Daily Life", Icon: Home },
  { id: "culture", name: "Culture", Icon: Landmark },
  { id: "work", name: "Work", Icon: Briefcase },
  { id: "news", name: "News", Icon: Newspaper },
  { id: "nature", name: "Nature", Icon: TreePine },
  { id: "technology", name: "Technology", Icon: Monitor },
  { id: "relationships", name: "Relationships", Icon: Users },
  { id: "health", name: "Health", Icon: Heart },
  { id: "entertainment", name: "Entertainment", Icon: Film },
  { id: "education", name: "Education", Icon: BookOpen },
] as const;

const LENGTH_OPTIONS = [
  { id: "short" as const, label: "Short", time: "~1 min" },
  { id: "medium" as const, label: "Medium", time: "~5 min" },
  { id: "long" as const, label: "Long", time: "~10 min" },
];

export default function LessonPlanPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userLevel, setUserLevel] = useState<number>(1);
  const [currentLesson, setCurrentLesson] = useState<LessonData | null>(null);
  const [recentLessons, setRecentLessons] = useState<LessonHistoryItem[]>([]);

  const [selectedLength, setSelectedLength] = useState<
    "short" | "medium" | "long"
  >("medium");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      const progressResponse = await fetch("/api/progress");
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        setUserLevel(progressData.skillLevels?.reading_level || 1);
      }

      const historyResponse = await fetch("/api/lesson/history?limit=5");
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setRecentLessons(historyData.lessons || []);

        const activeLesson = historyData.lessons?.find(
          (l: LessonHistoryItem) => l.status !== "completed"
        );
        if (activeLesson) {
          const lessonResponse = await fetch(
            `/api/lesson/${activeLesson.id}`
          );
          if (lessonResponse.ok) {
            const lessonData = await lessonResponse.json();
            setCurrentLesson(lessonData.lesson);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load lesson data");
    } finally {
      setIsLoading(false);
    }
  };

  const generateLesson = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch("/api/lesson/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic || undefined,
          length: selectedLength,
          useSuggestedTopic: !selectedTopic,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate lesson");
      }

      const data = await response.json();
      setCurrentLesson(data.lesson);
      setSelectedTopic(null);
      router.push(`/lesson-plan/${data.lesson.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate lesson"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const cefrLevel = numericLevelToCEFR(userLevel);
  const completedLessons = recentLessons.filter(
    (l) => l.status === "completed"
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Lesson Plan
          </h1>
          <p className="mt-1 text-muted-foreground">
            Personalized reading lessons tailored to your level
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium text-primary">Japanese</span>
          <span className="font-mono text-sm font-semibold text-primary">
            {cefrLevel}
          </span>
        </div>
      </div>

      <DowngradeLevelDialog
        open={showDowngradeDialog}
        onOpenChange={setShowDowngradeDialog}
        onDowngradeComplete={fetchData}
      />

      {/* Active lesson banner */}
      {currentLesson && currentLesson.status !== "completed" && (
        <button
          onClick={() => router.push(`/lesson-plan/${currentLesson.id}`)}
          className="group flex w-full items-center justify-between rounded-lg bg-primary px-6 py-5 text-left text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider opacity-60">
              Continue Lesson
            </span>
            <span className="text-lg font-semibold">{currentLesson.title}</span>
            <span className="text-xs opacity-70">
              {currentLesson.status === "reading"
                ? "Reading in progress"
                : "Ready to take the quiz"}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-primary-foreground/15 px-4 py-2 text-sm font-medium">
            Continue
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      )}

      {/* New Lesson section */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold">Start a New Lesson</span>
          {/* Length segmented control */}
          <div className="flex overflow-hidden rounded-md border bg-card">
            {LENGTH_OPTIONS.map((opt, idx) => (
              <button
                key={opt.id}
                onClick={() => setSelectedLength(opt.id)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium transition-colors",
                  idx < LENGTH_OPTIONS.length - 1 && "border-r",
                  selectedLength === opt.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Visual topic grid */}
        <div className="flex flex-wrap gap-3">
          {TOPICS.map((topic) => {
            const isSelected = selectedTopic === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() =>
                  setSelectedTopic(isSelected ? null : topic.id)
                }
                className={cn(
                  "flex w-[140px] flex-col justify-between rounded-lg border p-4 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-accent/50"
                )}
                style={{ height: 90 }}
              >
                <topic.Icon
                  className={cn(
                    "size-5",
                    isSelected
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                />
                <span className="text-sm font-medium">{topic.name}</span>
              </button>
            );
          })}
        </div>

        <Button
          className="w-fit"
          size="lg"
          onClick={generateLesson}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Preparing Lesson...
            </>
          ) : (
            <>
              Begin Lesson
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>

      {/* Recent lessons — horizontal strip */}
      {completedLessons.length > 0 && (
        <div className="flex flex-col gap-4">
          <span className="text-base font-semibold">Recent Lessons</span>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {completedLessons.map((lesson) => {
              const totalXP =
                (lesson.readingXpAwarded || 0) +
                (lesson.vocabularyXpAwarded || 0);
              const pct = lesson.percentage ?? 0;
              const isGood = pct >= 70;

              return (
                <button
                  key={lesson.id}
                  onClick={() => router.push(`/lesson-plan/${lesson.id}`)}
                  className="flex w-[220px] shrink-0 flex-col gap-2.5 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "font-mono text-2xl font-bold",
                        isGood ? "text-primary" : "text-chart-4"
                      )}
                    >
                      {pct}%
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xs font-medium",
                        isGood ? "text-primary" : "text-chart-4"
                      )}
                    >
                      +{totalXP} XP
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {lesson.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lesson.topic.name} ·{" "}
                      {lesson.length
                        ? lesson.length.charAt(0).toUpperCase() +
                          lesson.length.slice(1)
                        : ""}{" "}
                      ·{" "}
                      {new Date(lesson.createdAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" }
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {userLevel > 3 && (
        <button
          onClick={() => setShowDowngradeDialog(true)}
          className="w-fit text-xs text-muted-foreground hover:text-destructive hover:underline"
        >
          Feeling overwhelmed? Lower your level
        </button>
      )}
    </div>
  );
}
