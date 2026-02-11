"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { numericLevelToCEFR, SkillType } from "@/types/database";
import { BookOpen, Languages, PenTool } from "lucide-react";

const SKILL_CONFIG = {
  reading: {
    icon: BookOpen,
    color: "text-blue-500",
    bgColor: "bg-blue-500",
    label: "Reading",
  },
  vocabulary: {
    icon: Languages,
    color: "text-green-500",
    bgColor: "bg-green-500",
    label: "Vocabulary",
  },
  grammar: {
    icon: PenTool,
    color: "text-purple-500",
    bgColor: "bg-purple-500",
    label: "Grammar",
  },
} as const;

interface SkillLevelCardProps {
  skill: SkillType;
  level: number;
  xp: number;
  xpToNext: number;
  progress: number;
  weight: number;
}

export function SkillLevelCard({
  skill,
  level,
  xp,
  xpToNext,
  progress,
  weight,
}: SkillLevelCardProps) {
  const config = SKILL_CONFIG[skill];
  const Icon = config.icon;
  const cefr = numericLevelToCEFR(level);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Icon className={`h-5 w-5 ${config.color}`} />
            {config.label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{level}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${config.bgColor} text-white`}>
              {cefr}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress to Level {level + 1}</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{xp} / {xpToNext} XP</span>
          <span>Weight: {Math.round(weight * 100)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
