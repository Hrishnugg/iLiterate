"use client";

import { AssessmentQuestion } from "@/types/database";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

interface MCQQuestionProps {
  question: AssessmentQuestion;
  selectedAnswer?: string;
  onAnswer: (answer: string) => void;
  showResult?: boolean;
  disabled?: boolean;
}

export function MCQQuestion({
  question,
  selectedAnswer,
  onAnswer,
  showResult = false,
  disabled = false,
}: MCQQuestionProps) {
  const options = question.options || [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">{question.question}</h3>
        {question.hint && !showResult && (
          <p className="text-sm text-muted-foreground mt-1">
            Hint: {question.hint}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {options.map((option, index) => {
          const isSelected = selectedAnswer === option;
          const isCorrect = option === question.correct_answer;
          const showCorrect = showResult && isCorrect;
          const showIncorrect = showResult && isSelected && !isCorrect;

          return (
            <button
              key={index}
              type="button"
              onClick={() => !disabled && onAnswer(option)}
              disabled={disabled}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-colors",
                "flex items-center justify-between gap-3",
                !showResult && !disabled && "hover:bg-accent hover:border-accent-foreground/20",
                isSelected && !showResult && "border-primary bg-primary/5",
                showCorrect && "border-green-500 bg-green-50 dark:bg-green-950/20",
                showIncorrect && "border-red-500 bg-red-50 dark:bg-red-950/20",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-sm font-medium",
                    isSelected && !showResult && "border-primary bg-primary text-primary-foreground",
                    showCorrect && "border-green-500 bg-green-500 text-white",
                    showIncorrect && "border-red-500 bg-red-500 text-white",
                    !isSelected && !showResult && "border-muted-foreground/30"
                  )}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
              </span>

              {showResult && (
                <>
                  {showCorrect && (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  )}
                  {showIncorrect && (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {showResult && question.correct !== undefined && !question.correct && (
        <p className="text-sm text-muted-foreground">
          Correct answer: <span className="font-medium">{question.correct_answer}</span>
        </p>
      )}
    </div>
  );
}
