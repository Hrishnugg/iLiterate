"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowRight,
  Check,
  Shuffle,
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
import { toast } from "sonner";
import { useT } from "@/lib/i18n/I18nProvider";

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
  { id: "travel", name: "lessonPlan.topics.travel", Icon: Globe },
  { id: "food", name: "lessonPlan.topics.food", Icon: UtensilsCrossed },
  { id: "daily_life", name: "lessonPlan.topics.daily_life", Icon: Home },
  { id: "culture", name: "lessonPlan.topics.culture", Icon: Landmark },
  { id: "work", name: "lessonPlan.topics.work", Icon: Briefcase },
  { id: "news", name: "lessonPlan.topics.news", Icon: Newspaper },
  { id: "nature", name: "lessonPlan.topics.nature", Icon: TreePine },
  { id: "technology", name: "lessonPlan.topics.technology", Icon: Monitor },
  { id: "relationships", name: "lessonPlan.topics.relationships", Icon: Users },
  { id: "health", name: "lessonPlan.topics.health", Icon: Heart },
  { id: "entertainment", name: "lessonPlan.topics.entertainment", Icon: Film },
  { id: "education", name: "lessonPlan.topics.education", Icon: BookOpen },
] as const;

const LENGTH_OPTIONS = [
  { id: "short" as const, label: "lessonPlan.lengthShort", time: "~1 min" },
  { id: "medium" as const, label: "lessonPlan.lengthMedium", time: "~5 min" },
  { id: "long" as const, label: "lessonPlan.lengthLong", time: "~10 min" },
];

export default function LessonPlanPage() {
  const router = useRouter();
  const t = useT();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [userLevel, setUserLevel] = useState<number>(1);
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null);
  const [currentLesson, setCurrentLesson] = useState<LessonData | null>(null);
  const [recentLessons, setRecentLessons] = useState<LessonHistoryItem[]>([]);

  const [selectedLength, setSelectedLength] = useState<
    "short" | "medium" | "long"
  >("medium");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
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
        setTargetLanguage(progressData.targetLanguage ?? null);
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
      toast.error("Failed to load lesson data");
    } finally {
      setIsLoading(false);
    }
  };

  const generateLesson = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch("/api/lesson/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: selectedTopics.length > 0 ? selectedTopics : undefined,
          length: selectedLength,
          useSuggestedTopic: selectedTopics.length === 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate lesson");
      }

      const data = await response.json();
      setCurrentLesson(data.lesson);
      setSelectedTopics([]);
      router.push(`/lesson-plan/${data.lesson.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate lesson");
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
          <h1 className="text-2xl font-bold">{t("lessonPlan.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("lessonPlan.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium text-primary">
            {targetLanguage ? t(`library.languages.${targetLanguage}` as Parameters<typeof t>[0]) || targetLanguage : ""}
          </span>
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
              {t("lessonPlan.continueLesson")}
            </span>
            <span className="text-lg font-semibold">{currentLesson.title}</span>
            <span className="text-xs opacity-70">
              {currentLesson.status === "reading"
                ? t("lessonPlan.readingInProgress")
                : t("lessonPlan.readyForQuiz")}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-primary-foreground/15 px-4 py-2 text-sm font-medium">
            {t("common.continue")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      )}

      {/* New Lesson section */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold">{t("lessonPlan.startNewLesson")}</span>
            {selectedTopics.length === 0 ? (
              <span className="text-xs text-muted-foreground">{t("lessonPlan.selectTopics")}</span>
            ) : (
              <span className="text-xs text-primary/70">{t("lessonPlan.topicsSelected").replace("{count}", String(selectedTopics.length))}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Clear + Shuffle buttons */}
            <div className="flex items-center gap-1">
              <AnimatePresence>
                {selectedTopics.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, x: 8, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: "auto" }}
                    exit={{ opacity: 0, x: 8, width: 0 }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                    onClick={() => setSelectedTopics([])}
                    className="inline-flex items-center gap-1.5 overflow-hidden rounded-md border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t("common.clear")}
                  </motion.button>
                )}
              </AnimatePresence>
              <button
                onClick={() => {
                  const shuffled = [...TOPICS].sort(() => Math.random() - 0.5);
                  const count = Math.floor(Math.random() * 3) + 1;
                  setSelectedTopics(shuffled.slice(0, count).map((t) => t.id));
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground transition-colors cursor-pointer"
              >
                <Shuffle className="size-3" />
                {t("lessonPlan.shuffle")}
              </button>
            </div>
            {/* Length segmented control */}
            <div className="inline-flex rounded-lg bg-muted p-[3px]">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedLength(opt.id)}
                className={cn(
                  "relative cursor-pointer px-4 py-1 text-xs font-medium transition-colors duration-150",
                  selectedLength === opt.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {selectedLength === opt.id && (
                  <motion.div
                    layoutId="length-pill"
                    className="absolute inset-0 rounded-md bg-primary/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                  />
                )}
                <span className="relative z-10">{t(opt.label)}</span>
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Topic chips */}
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic, i) => {
            const isSelected = selectedTopics.includes(topic.id);
            const isDisabled = !isSelected && selectedTopics.length >= 3;
            return (
              <motion.button
                key={topic.id}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: isDisabled ? 0.3 : 1, scale: 1 }}
                transition={{ delay: i * 0.025, duration: 0.2 }}
                onClick={() => {
                  if (isSelected) {
                    setSelectedTopics(selectedTopics.filter((t) => t !== topic.id));
                  } else if (selectedTopics.length < 3) {
                    setSelectedTopics([...selectedTopics, topic.id]);
                  }
                }}
                disabled={isDisabled}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150",
                  isSelected
                    ? "cursor-pointer border-primary/60 bg-primary/15 text-primary"
                    : isDisabled
                    ? "cursor-not-allowed border-border/30 bg-card/50 text-muted-foreground/50"
                    : "cursor-pointer border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                )}
              >
                <motion.span
                  key={isSelected ? "check" : "icon"}
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="shrink-0"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {isSelected
                    ? <Check className="size-3.5 text-primary" />
                    : <topic.Icon className="size-3.5" />
                  }
                </motion.span>
                <span>{t(topic.name)}</span>
              </motion.button>
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
              {t("lessonPlan.preparingLesson")}
            </>
          ) : (
            <>
              {t("lessonPlan.beginLesson")}
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>

      {/* Recent lessons — horizontal strip */}
      {completedLessons.length > 0 && (
        <div className="flex flex-col gap-4">
          <span className="text-base font-semibold">{t("lessonPlan.recentLessons")}</span>
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
                  className="flex w-[220px] shrink-0 cursor-pointer flex-col gap-2.5 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50 hover:border-primary/40"
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
                      {t(`lessonPlan.topics.${lesson.topic.id}` as Parameters<typeof t>[0]) || lesson.topic.name} ·{" "}
                      {lesson.length
                        ? t(`lessonPlan.length${lesson.length.charAt(0).toUpperCase() + lesson.length.slice(1)}` as Parameters<typeof t>[0]) || lesson.length
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
          {t("lessonPlan.feelingOverwhelmed")}
        </button>
      )}
    </div>
  );
}
