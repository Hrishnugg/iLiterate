"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MCQQuestion } from "./MCQQuestion";
import { FillBlankQuestion } from "./FillBlankQuestion";
import { QuizResults } from "./QuizResults";
import { useT, T } from "@/lib/i18n/I18nProvider";
import { AssessmentQuestion } from "@/types/database";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface QuizContainerProps {
  contentId: string;
  contentTitle?: string;
  onComplete?: () => void;
}

interface QuizState {
  questions: AssessmentQuestion[];
  contentLevel: number;
  generatedAt: string;
}

interface SubmitResult {
  results: {
    totalScore: number;
    totalMaxScore: number;
    percentage: number;
    reading: {
      score: number;
      maxScore: number;
      xpAwarded: { skill: string; baseXP: number; bonusXP: number; totalXP: number; reason: string };
      levelUp: { from: number; to: number; newCEFR: string; crossedCEFRBoundary: boolean } | null;
    };
    vocabulary: {
      score: number;
      maxScore: number;
      xpAwarded: { skill: string; baseXP: number; bonusXP: number; totalXP: number; reason: string };
      levelUp: { from: number; to: number; newCEFR: string; crossedCEFRBoundary: boolean } | null;
    };
  };
  gradedQuestions: AssessmentQuestion[];
  newLevels: {
    reading: number;
    vocabulary: number;
    grammar: number;
  };
}

export function QuizContainer({
  contentId,
  contentTitle,
  onComplete,
}: QuizContainerProps) {
  const t = useT();
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [startTime] = useState(Date.now());

  // Load quiz on mount
  useEffect(() => {
    async function loadQuiz() {
      try {
        const response = await fetch("/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate quiz");
        }

        const data = await response.json();
        setQuiz(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quiz");
      } finally {
        setIsLoading(false);
      }
    }

    loadQuiz();
  }, [contentId]);

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (quiz && currentIndex < quiz.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    setIsSubmitting(true);
    const timeTakenSeconds = Math.floor((Date.now() - startTime) / 1000);

    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          questions: quiz.questions,
          answers,
          timeTakenSeconds,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit quiz");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">{t("quizzes.generating")}</p>
          <p className="text-sm text-muted-foreground">
            {t("quizzes.secondsTaken")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>{t("quizzes.tryAgain")}</Button>
        </CardContent>
      </Card>
    );
  }

  // Results state
  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <QuizResults
          results={result.results}
          newLevels={result.newLevels}
          contentTitle={contentTitle}
          onContinue={onComplete}
        />
      </div>
    );
  }

  // No quiz loaded
  if (!quiz || quiz.questions.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{t("quizzes.noQuestions")}</p>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = quiz.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === quiz.questions.length;
  const progressPercent = (answeredCount / quiz.questions.length) * 100;

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("quizzes.readingQuiz")}</CardTitle>
            <CardDescription>
              {t("quizzes.questionCount").replace("{current}", String(currentIndex + 1)).replace("{total}", String(quiz.questions.length))}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {t("quizzes.answered").replace("{current}", String(answeredCount)).replace("{total}", String(quiz.questions.length))}
            </div>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Question Type Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              currentQuestion.type === "comprehension_mcq"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            }`}
          >
            {currentQuestion.type === "comprehension_mcq"
              ? t("quizzes.readingComprehension")
              : t("quizzes.vocabulary")}
          </span>
        </div>

        {/* Question Component */}
        {currentQuestion.type === "comprehension_mcq" ? (
          <MCQQuestion
            question={currentQuestion}
            selectedAnswer={answers[currentQuestion.id]}
            onAnswer={(answer) => handleAnswer(currentQuestion.id, answer)}
          />
        ) : (
          <FillBlankQuestion
            question={currentQuestion}
            answer={answers[currentQuestion.id] || ""}
            onAnswer={(answer) => handleAnswer(currentQuestion.id, answer)}
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("quizzes.previous")}
          </Button>

          <div className="flex gap-1">
            {quiz.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === currentIndex
                    ? "bg-primary"
                    : answers[quiz.questions[index].id]
                    ? "bg-primary/50"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {currentIndex === quiz.questions.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("quizzes.submitting")}
                </>
              ) : (
                t("quizzes.submitQuiz")
              )}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              {t("common.next")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
