import { Flame } from "lucide-react";

export function StreakTile({ days }: { days: number }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-primary" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Streak
        </span>
      </div>
      <div className="mt-3">
        <span className="font-mono text-4xl font-semibold tracking-tight">
          {days}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          {days === 1 ? "day" : "days"} in a row
        </p>
      </div>
    </div>
  );
}
