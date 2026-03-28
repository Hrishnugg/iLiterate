"use client";

import { formatInterval } from "@/lib/spaced-repetition";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/I18nProvider";

type ResponseQuality = "again" | "hard" | "good" | "easy";

interface IntervalPreview {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

interface ReviewButtonsProps {
  intervalPreview: IntervalPreview;
  onResponse: (response: ResponseQuality) => void;
  disabled?: boolean;
}

const buttonConfig: {
  response: ResponseQuality;
  label: string;
  key: string;
  className: string;
}[] = [
  {
    response: "again",
    label: "flashcards.again",
    key: "1",
    className:
      "border-destructive/40 text-destructive hover:bg-destructive/10",
  },
  {
    response: "hard",
    label: "flashcards.hard",
    key: "2",
    className: "border-chart-4/40 text-chart-4 hover:bg-chart-4/10",
  },
  {
    response: "good",
    label: "flashcards.good",
    key: "3",
    className:
      "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
  },
  {
    response: "easy",
    label: "flashcards.easy",
    key: "4",
    className:
      "bg-primary text-primary-foreground hover:bg-primary/90 border-primary",
  },
];

export function ReviewButtons({
  intervalPreview,
  onResponse,
  disabled = false,
}: ReviewButtonsProps) {
  const t = useT();
  return (
    <div className="mx-auto flex w-full max-w-lg gap-3">
      {buttonConfig.map(({ response, label, key, className }) => (
        <button
          key={response}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-lg border px-4 py-4 text-sm font-medium transition-colors disabled:opacity-50",
            className
          )}
          onClick={() => onResponse(response)}
          disabled={disabled}
        >
          <span>{t(label)}</span>
          <span className="font-mono text-[10px] opacity-60">
            {formatInterval(intervalPreview[response])}
          </span>
          <kbd className="mt-1 rounded border bg-background/50 px-1.5 py-0.5 font-mono text-[9px] opacity-40">
            {key}
          </kbd>
        </button>
      ))}
    </div>
  );
}

export type { ResponseQuality, IntervalPreview };
