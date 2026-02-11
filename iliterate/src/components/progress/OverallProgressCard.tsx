"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const CEFR_COLORS: Record<CEFRLevel, string> = {
  A1: "from-gray-400 to-gray-500",
  A2: "from-green-400 to-green-500",
  B1: "from-blue-400 to-blue-500",
  B2: "from-indigo-400 to-indigo-500",
  C1: "from-purple-400 to-purple-500",
  C2: "from-yellow-400 to-yellow-500",
};

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
    <Card className="overflow-hidden">
      <div className={`h-2 bg-gradient-to-r ${CEFR_COLORS[cefr]}`} />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Overall Level</CardTitle>
            <CardDescription>{CEFR_DESCRIPTIONS[cefr]}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-4xl font-bold">{level}</div>
              <div className={`text-lg font-semibold bg-gradient-to-r ${CEFR_COLORS[cefr]} bg-clip-text text-transparent`}>
                {cefr}
              </div>
            </div>
            <Trophy className="h-10 w-10 text-yellow-500" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-500">
              {skillLevels.reading}
            </div>
            <div className="text-xs text-muted-foreground">Reading</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-500">
              {skillLevels.vocabulary}
            </div>
            <div className="text-xs text-muted-foreground">Vocabulary</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-500">
              {skillLevels.grammar}
            </div>
            <div className="text-xs text-muted-foreground">Grammar</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
