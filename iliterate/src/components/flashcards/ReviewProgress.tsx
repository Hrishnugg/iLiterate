"use client";

import { Progress } from "@/components/ui/progress";

interface ReviewProgressProps {
  completed: number;
  total: number;
  remainingReviews?: number;
  isPremium?: boolean;
}

export function ReviewProgress({
  completed,
  total,
  remainingReviews,
  isPremium = false,
}: ReviewProgressProps) {
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="w-full max-w-xl mx-auto space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">
          {completed} / {total} cards
        </span>
        {!isPremium && remainingReviews !== undefined && (
          <span className="text-muted-foreground">
            {remainingReviews} reviews left today
          </span>
        )}
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
