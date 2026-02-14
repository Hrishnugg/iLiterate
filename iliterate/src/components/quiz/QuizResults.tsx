"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { numericLevelToCEFR } from "@/types/database";
import { Trophy, Star, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

interface XPAward {
  skill: string;
  baseXP: number;
  bonusXP: number;
  totalXP: number;
  reason: string;
}

interface LevelUp {
  from: number;
  to: number;
  newCEFR: string;
  crossedCEFRBoundary: boolean;
}

interface SkillResult {
  score: number;
  maxScore: number;
  xpAwarded: XPAward;
  levelUp: LevelUp | null;
}

interface QuizResultsProps {
  results: {
    totalScore: number;
    totalMaxScore: number;
    percentage: number;
    reading: SkillResult;
    vocabulary: SkillResult;
  };
  newLevels: {
    reading: number;
    vocabulary: number;
    grammar: number;
  };
  contentTitle?: string;
  onContinue?: () => void;
}

export function QuizResults({
  results,
  newLevels,
  contentTitle,
  onContinue,
}: QuizResultsProps) {
  const { totalScore, totalMaxScore, percentage, reading, vocabulary } = results;

  const hasLevelUp = reading.levelUp || vocabulary.levelUp;
  const totalXP = reading.xpAwarded.totalXP + vocabulary.xpAwarded.totalXP;

  // Determine performance message
  let performanceMessage: string;
  let performanceIcon: React.ReactNode;

  if (percentage >= 90) {
    performanceMessage = "Excellent work!";
    performanceIcon = <Trophy className="h-8 w-8 text-yellow-500" />;
  } else if (percentage >= 70) {
    performanceMessage = "Great job!";
    performanceIcon = <Star className="h-8 w-8 text-blue-500" />;
  } else if (percentage >= 50) {
    performanceMessage = "Good effort!";
    performanceIcon = <TrendingUp className="h-8 w-8 text-green-500" />;
  } else {
    performanceMessage = "Keep practicing!";
    performanceIcon = <Sparkles className="h-8 w-8 text-purple-500" />;
  }

  return (
    <div className="space-y-6">
      {/* Main Results Card */}
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2">{performanceIcon}</div>
          <CardTitle className="text-2xl">{performanceMessage}</CardTitle>
          {contentTitle && (
            <CardDescription>Quiz for: {contentTitle}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="text-center">
            <div className="text-5xl font-bold">
              {totalScore}/{totalMaxScore}
            </div>
            <div className="text-lg text-muted-foreground">{percentage}% correct</div>
            <Progress value={percentage} className="h-3 mt-4" />
          </div>

          {/* XP Earned */}
          <div className="rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 p-4 text-center">
            <div className="text-sm text-muted-foreground">XP Earned</div>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              +{totalXP} XP
            </div>
          </div>

          {/* Level Up Celebration */}
          {hasLevelUp && (
            <div className="rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <span className="font-semibold text-purple-700 dark:text-purple-300">
                  Level Up!
                </span>
              </div>
              <div className="space-y-2">
                {reading.levelUp && (
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Reading: </span>
                    <span className="font-medium">
                      Level {reading.levelUp.from} → {reading.levelUp.to}
                    </span>
                    {reading.levelUp.crossedCEFRBoundary && (
                      <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900 px-2 py-0.5 rounded">
                        Now {reading.levelUp.newCEFR}!
                      </span>
                    )}
                  </div>
                )}
                {vocabulary.levelUp && (
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Vocabulary: </span>
                    <span className="font-medium">
                      Level {vocabulary.levelUp.from} → {vocabulary.levelUp.to}
                    </span>
                    {vocabulary.levelUp.crossedCEFRBoundary && (
                      <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900 px-2 py-0.5 rounded">
                        Now {vocabulary.levelUp.newCEFR}!
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Reading */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reading Comprehension</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">
                {reading.score}/{reading.maxScore}
              </span>
              <span className="text-sm text-muted-foreground">
                +{reading.xpAwarded.totalXP} XP
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {reading.xpAwarded.reason}
            </div>
            <div className="mt-2 text-sm">
              Current Level: <span className="font-medium">{newLevels.reading}</span>
              <span className="text-muted-foreground ml-1">
                ({numericLevelToCEFR(newLevels.reading)})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Vocabulary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vocabulary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">
                {vocabulary.score}/{vocabulary.maxScore}
              </span>
              <span className="text-sm text-muted-foreground">
                +{vocabulary.xpAwarded.totalXP} XP
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {vocabulary.xpAwarded.reason}
            </div>
            <div className="mt-2 text-sm">
              Current Level: <span className="font-medium">{newLevels.vocabulary}</span>
              <span className="text-muted-foreground ml-1">
                ({numericLevelToCEFR(newLevels.vocabulary)})
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/library">
            Back to Library
          </Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/progress">
            View Progress
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
