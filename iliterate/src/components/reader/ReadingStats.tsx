"use client";

import { useState, useRef, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Clock, BookOpen, Target } from "lucide-react";

interface ReadingStatsProps {
  progress: number; // 0-100
  wordsRead: number;
  totalWords: number;
  timeRemaining: string;
  isInteractive?: boolean;
  onSeek?: (percentage: number) => void;
  className?: string;
}

export function ReadingStats({
  progress,
  wordsRead,
  totalWords,
  timeRemaining,
  isInteractive = false,
  onSeek,
  className,
}: ReadingStatsProps) {
  const isCompleted = progress >= 100;
  const [isDragging, setIsDragging] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const calculatePercentage = (clientX: number) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInteractive || !onSeek) return;
    e.preventDefault();
    setIsDragging(true);
    const percentage = calculatePercentage(e.clientX);
    onSeek(percentage);
  };

  useEffect(() => {
    if (!isDragging || !isInteractive || !onSeek) return;

    const handleMouseMove = (e: MouseEvent) => {
      const percentage = calculatePercentage(e.clientX);
      onSeek(percentage);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isInteractive, onSeek]);

  return (
    <div className={cn("p-4", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Reading Progress
      </h3>

      <div className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{Math.round(progress)}%</span>
            <span className="text-xs text-muted-foreground">
              {isCompleted ? "Completed" : `${timeRemaining} remaining`}
            </span>
          </div>
          <div
            ref={progressBarRef}
            onMouseDown={handleMouseDown}
            className={cn(
              isInteractive && "cursor-pointer hover:opacity-80 transition-opacity select-none",
              isDragging && "opacity-80"
            )}
            title={isInteractive ? "Click or drag to seek" : undefined}
          >
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              Words Read
            </div>
            <p className="mt-1 text-lg font-semibold">
              {wordsRead.toLocaleString()}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / {totalWords.toLocaleString()}
              </span>
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Time Left
            </div>
            <p className="mt-1 text-lg font-semibold">{timeRemaining}</p>
          </div>
        </div>

        {/* Completion badge */}
        {isCompleted && (
          <div className="rounded-lg bg-green-500/10 p-3 text-center">
            <p className="text-sm font-medium text-green-600">
              🎉 Article completed!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
