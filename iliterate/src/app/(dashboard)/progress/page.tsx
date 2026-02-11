"use client";

import { useEffect, useState } from "react";
import { SkillLevelCard } from "@/components/progress/SkillLevelCard";
import { OverallProgressCard } from "@/components/progress/OverallProgressCard";
import { SkillWeightsEditor } from "@/components/progress/SkillWeightsEditor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ClipboardCheck, Calendar } from "lucide-react";
import { CEFRLevel } from "@/types/database";

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

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = async () => {
    try {
      const response = await fetch("/api/progress");
      if (!response.ok) throw new Error("Failed to fetch progress");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load progress");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error || "Failed to load progress"}</p>
      </div>
    );
  }

  const { progressInfo, recentAssessments } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Your Progress</h1>
        <p className="text-muted-foreground mt-1">
          Track your language learning journey across all skills
        </p>
      </div>

      {/* Overall Progress */}
      <OverallProgressCard
        level={progressInfo.overall.level}
        cefr={progressInfo.overall.cefr}
        skillLevels={{
          reading: progressInfo.reading.level,
          vocabulary: progressInfo.vocabulary.level,
          grammar: progressInfo.grammar.level,
        }}
      />

      {/* Individual Skills */}
      <div className="grid gap-4 md:grid-cols-3">
        <SkillLevelCard
          skill="reading"
          level={progressInfo.reading.level}
          xp={progressInfo.reading.xp}
          xpToNext={progressInfo.reading.xpToNext}
          progress={progressInfo.reading.progress}
          weight={progressInfo.reading.weight}
        />
        <SkillLevelCard
          skill="vocabulary"
          level={progressInfo.vocabulary.level}
          xp={progressInfo.vocabulary.xp}
          xpToNext={progressInfo.vocabulary.xpToNext}
          progress={progressInfo.vocabulary.progress}
          weight={progressInfo.vocabulary.weight}
        />
        <SkillLevelCard
          skill="grammar"
          level={progressInfo.grammar.level}
          xp={progressInfo.grammar.xp}
          xpToNext={progressInfo.grammar.xpToNext}
          progress={progressInfo.grammar.progress}
          weight={progressInfo.grammar.weight}
        />
      </div>

      {/* Weights Editor */}
      <SkillWeightsEditor
        currentWeights={{
          reading: progressInfo.reading.weight,
          vocabulary: progressInfo.vocabulary.weight,
          grammar: progressInfo.grammar.weight,
        }}
        onUpdate={fetchProgress}
      />

      {/* Recent Assessments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Recent Assessments
          </CardTitle>
          <CardDescription>Your quiz history and XP earned</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAssessments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No assessments yet. Complete a reading and take a quiz to see your progress!
            </p>
          ) : (
            <div className="space-y-3">
              {recentAssessments.map((assessment) => {
                const totalScore =
                  (assessment.reading_score || 0) + (assessment.vocabulary_score || 0);
                const totalMax =
                  (assessment.reading_max_score || 0) + (assessment.vocabulary_max_score || 0);
                const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
                const totalXP =
                  (assessment.reading_xp_awarded || 0) + (assessment.vocabulary_xp_awarded || 0);

                return (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                          percentage >= 70
                            ? "bg-green-500"
                            : percentage >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      >
                        {percentage}%
                      </div>
                      <div>
                        <p className="font-medium">
                          {assessment.content?.title || "Reading Quiz"}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(assessment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-yellow-600 dark:text-yellow-400">
                        +{totalXP} XP
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {totalScore}/{totalMax} correct
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
