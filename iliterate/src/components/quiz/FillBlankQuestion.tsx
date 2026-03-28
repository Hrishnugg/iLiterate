"use client";

import { AssessmentQuestion } from "@/types/database";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

interface FillBlankQuestionProps {
  question: AssessmentQuestion;
  answer: string;
  onAnswer: (answer: string) => void;
  showResult?: boolean;
  disabled?: boolean;
}

export function FillBlankQuestion({
  question,
  answer,
  onAnswer,
  showResult = false,
  disabled = false,
}: FillBlankQuestionProps) {
  const t = useT();
  const isCorrect = question.correct;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">{question.question}</h3>
        {question.context && (
          <p className="text-sm text-muted-foreground mt-1">
            {question.context}
          </p>
        )}
        {question.hint && !showResult && (
          <p className="text-sm text-muted-foreground mt-1 italic">
            {t("quizzes.hint").replace("{hint}", question.hint)}
          </p>
        )}
      </div>

      <div className="relative">
        <Input
          type="text"
          value={answer}
          onChange={(e) => !disabled && onAnswer(e.target.value)}
          placeholder={t("quizzes.typeAnswer")}
          disabled={disabled}
          className={cn(
            "text-lg pr-10",
            showResult && isCorrect && "border-green-500 bg-green-50 dark:bg-green-950/20",
            showResult && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-950/20"
          )}
        />
        {showResult && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isCorrect ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
        )}
      </div>

      {showResult && !isCorrect && (
        <div className="text-sm">
          <span className="text-muted-foreground">{t("quizzes.correctAnswer")}</span>
          <span className="font-medium text-green-600 dark:text-green-400">
            {question.correct_answer}
          </span>
        </div>
      )}
    </div>
  );
}
