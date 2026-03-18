import { GraduationCap, Layers } from "lucide-react";

interface ActivityItem {
  id: string;
  title: string;
  type: "lesson" | "flashcards" | "quiz";
  detail: string;
  xp: number;
}

export function RecentActivityBand({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6" style={{ gridColumn: "1 / -1" }}>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent Activity
        </span>
        <p className="mt-3 text-sm text-muted-foreground">
          No recent activity. Start a lesson to get going!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6" style={{ gridColumn: "1 / -1" }}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Recent Activity
      </span>
      <div className="mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
              {item.type === "flashcards" ? (
                <Layers className="size-3.5 text-primary" />
              ) : (
                <GraduationCap className="size-3.5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{item.title}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {item.detail}
              </span>
            </div>
            <span className="shrink-0 font-mono text-xs font-medium text-primary">
              +{item.xp} XP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
