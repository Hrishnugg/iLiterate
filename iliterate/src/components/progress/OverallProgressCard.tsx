"use client";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { CEFRLevel } from "@/types/database";
import { Trophy } from "lucide-react";

const CEFR_DESCRIPTIONS: Record<CEFRLevel, string> = {
  A1: "Absolute Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
  C1: "Advanced",
  C2: "Mastery",
};

const CEFR_LABEL_COLORS: Record<CEFRLevel, string> = {
  A1: "text-muted-foreground",
  A2: "text-chart-2",
  B1: "text-chart-1",
  B2: "text-chart-3",
  C1: "text-chart-4",
  C2: "text-chart-5",
};

const SKILL_COLORS = {
  reading: "text-chart-1",
  vocabulary: "text-chart-2",
  grammar: "text-chart-4",
} as const;

interface OverallProgressCardProps {
  level: number;
  cefr: CEFRLevel;
  skillLevels: {
    reading: number;
    vocabulary: number;
    grammar: number;
  };
}

export function OverallProgressCard({
  level,
  cefr,
  skillLevels,
}: OverallProgressCardProps) {
  return (
    <Card className="overflow-hidden rounded-xl"
      role="article"
      aria-labelledby="overall-level-heading"
      aria-describedby="overall-level-desc"
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-1">
            <h2
              id="overall-level-heading"
              className="text-lg font-semibold leading-none text-balance"
            >
              Overall Level
            </h2>
              <CardDescription id="overall-level-desc" className="truncate">
                {CEFR_DESCRIPTIONS[cefr]}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right tabular-nums">
                <div className="text-3xl font-bold tabular-nums">
                  {level}
                </div>
                <div className={`text-base font-semibold ${CEFR_LABEL_COLORS[cefr]}`}>
                  {cefr}
                </div>
              </div>
              <Trophy
                className="h-9 w-9 text-chart-4 opacity-90"
                aria-hidden="true"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            className="grid grid-cols-3 gap-4 rounded-lg border-t border-r border-b border-border bg-muted/30 px-4 py-4"
            role="group"
            aria-label="Skill levels"
          >
            <div className="text-center min-w-0">
              <div className={`text-xl font-bold tabular-nums ${SKILL_COLORS.reading}`}>
                {skillLevels.reading}
              </div>
              <div className="text-xs text-muted-foreground truncate">Reading</div>
            </div>
            <div className="text-center min-w-0 border-x border-border/60">
              <div className={`text-xl font-bold tabular-nums ${SKILL_COLORS.vocabulary}`}>
                {skillLevels.vocabulary}
              </div>
              <div className="text-xs text-muted-foreground truncate">Vocabulary</div>
            </div>
            <div className="text-center min-w-0">
              <div className={`text-xl font-bold tabular-nums ${SKILL_COLORS.grammar}`}>
                {skillLevels.grammar}
              </div>
              <div className="text-xs text-muted-foreground truncate">Grammar</div>
            </div>
          </div>
        </CardContent>
    </Card>
  );
}
