"use client";

import { useEffect, useState } from "react";
import { SkillWeightsEditor } from "@/components/progress/SkillWeightsEditor";
import { DowngradeLevelDialog } from "@/components/lesson/DowngradeLevelDialog";
import { Loader2, BookOpen, Layers, FileText } from "lucide-react";
import { CEFRLevel } from "@/types/database";
import { cn } from "@/lib/utils";

interface SkillProgress {
  level: number;
  xp: number;
  xpToNext: number;
  progress: number;
  cefr: CEFRLevel;
  weight: number;
}

interface ProgressData {
  skillLevels: {
    id: string;
    reading_level: number;
    vocabulary_level: number;
    grammar_level: number;
    reading_xp: number;
    vocabulary_xp: number;
    grammar_xp: number;
    reading_weight: number;
    vocabulary_weight: number;
    grammar_weight: number;
  };
  progressInfo: {
    reading: SkillProgress;
    vocabulary: SkillProgress;
    grammar: SkillProgress;
    overall: {
      level: number;
      cefr: CEFRLevel;
    };
  };
  recentAssessments: Array<{
    id: string;
    assessment_type: string;
    reading_score: number;
    reading_max_score: number;
    vocabulary_score: number;
    vocabulary_max_score: number;
    reading_xp_awarded: number;
    vocabulary_xp_awarded: number;
    created_at: string;
    content?: {
      id: string;
      title: string;
      difficulty_level: string;
    };
  }>;
}

const skillMeta = {
  reading: { label: "Reading", icon: BookOpen },
  vocabulary: { label: "Vocabulary", icon: Layers },
  grammar: { label: "Grammar", icon: FileText },
} as const;

const cefrDescription: Record<CEFRLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);

  const fetchProgress = async () => {
    try {
      const response = await fetch("/api/progress");
      if (!response.ok) throw new Error("Failed to fetch progress");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load progress"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-destructive">
          {error || "Failed to load progress"}
        </p>
      </div>
    );
  }

  const { progressInfo, recentAssessments } = data;

  return (
    <div className="flex flex-col gap-10">
      {/* Hero — Dramatic Level Display */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Your Level
        </span>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-8xl font-bold leading-none tracking-tighter text-foreground">
            {progressInfo.overall.cefr}
          </span>
          <div className="relative">
            <span className="absolute bottom-full mb-1 text-sm font-medium leading-none text-muted-foreground">
              Level {progressInfo.overall.level}
            </span>
            <span className="text-lg leading-none text-muted-foreground">
              {cefrDescription[progressInfo.overall.cefr]}
            </span>
          </div>
        </div>
        {progressInfo.reading.level > 3 && (
          <button
            onClick={() => setShowDowngradeDialog(true)}
            className="mt-1 w-fit text-xs text-muted-foreground hover:text-destructive hover:underline"
          >
            Feeling overwhelmed? Lower your level
          </button>
        )}
      </div>

      <DowngradeLevelDialog
        open={showDowngradeDialog}
        onOpenChange={setShowDowngradeDialog}
        onDowngradeComplete={fetchProgress}
      />

      {/* Skill Band — 3 skills in one unified container */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Skills
        </span>
        <div className="flex overflow-hidden rounded-lg border bg-card">
          {(["reading", "vocabulary", "grammar"] as const).map(
            (skill, idx) => {
              const info = progressInfo[skill];
              const meta = skillMeta[skill];
              const Icon = meta.icon;

              return (
                <div
                  key={skill}
                  className={cn(
                    "flex flex-1 flex-col gap-3 p-5",
                    idx < 2 && "border-r"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-primary" />
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
                      {info.cefr}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(info.progress, 1)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {info.progress}% to next
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {info.xp} XP
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Skill Weights */}
      <SkillWeightsEditor
        currentWeights={{
          reading: progressInfo.reading.weight,
          vocabulary: progressInfo.vocabulary.weight,
          grammar: progressInfo.grammar.weight,
        }}
        onUpdate={fetchProgress}
      />

      {/* Recent Assessments */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent Assessments
        </span>
        {recentAssessments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No assessments yet. Complete a lesson to see your history.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentAssessments.map((assessment) => {
              const totalScore =
                (assessment.reading_score || 0) +
                (assessment.vocabulary_score || 0);
              const totalMax =
                (assessment.reading_max_score || 0) +
                (assessment.vocabulary_max_score || 0);
              const percentage =
                totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
              const totalXP =
                (assessment.reading_xp_awarded || 0) +
                (assessment.vocabulary_xp_awarded || 0);

              return (
                <div
                  key={assessment.id}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4"
                >
                  {/* Score dot */}
                  <div
                    className={cn(
                      "flex size-2 shrink-0 rounded-full",
                      percentage >= 70
                        ? "bg-primary"
                        : percentage >= 50
                        ? "bg-chart-4"
                        : "bg-destructive"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">
                      {assessment.content?.title || "Reading Quiz"}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(assessment.created_at).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" }
                      )}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold",
                      percentage >= 70
                        ? "text-primary"
                        : percentage >= 50
                        ? "text-chart-4"
                        : "text-destructive"
                    )}
                  >
                    {percentage}%
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    +{totalXP} XP
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
