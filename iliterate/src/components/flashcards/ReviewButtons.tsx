"use client";

import { Button } from "@/components/ui/button";
import { formatInterval } from "@/lib/spaced-repetition";
import { cn } from "@/lib/utils";

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
  variant: "destructive" | "outline" | "default" | "secondary";
  className: string;
}[] = [
  {
    response: "again",
    label: "Again",
    variant: "destructive",
    className: "flex-1",
  },
  {
    response: "hard",
    label: "Hard",
    variant: "outline",
    className: "flex-1 border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700",
  },
  {
    response: "good",
    label: "Good",
    variant: "default",
    className: "flex-1",
  },
  {
    response: "easy",
    label: "Easy",
    variant: "secondary",
    className: "flex-1 bg-green-100 text-green-700 hover:bg-green-200",
  },
];

export function ReviewButtons({
  intervalPreview,
  onResponse,
  disabled = false,
}: ReviewButtonsProps) {
  return (
    <div className="flex gap-2 w-full max-w-xl mx-auto">
      {buttonConfig.map(({ response, label, variant, className }) => (
        <Button
          key={response}
          variant={variant}
          className={cn("flex-col h-auto py-3", className)}
          onClick={() => onResponse(response)}
          disabled={disabled}
        >
          <span className="font-semibold">{label}</span>
          <span className="text-xs opacity-80">
            {formatInterval(intervalPreview[response])}
          </span>
        </Button>
      ))}
    </div>
  );
}

export type { ResponseQuality, IntervalPreview };
