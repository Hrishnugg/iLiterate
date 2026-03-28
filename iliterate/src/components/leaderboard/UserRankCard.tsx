"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

interface UserRankCardProps {
  rank: number;
  points: number;
  totalParticipants: number;
}

export function UserRankCard({ rank, points, totalParticipants }: UserRankCardProps) {
  const t = useT();
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Trophy className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{t("leaderboard.yourRank")}</p>
          <p className="text-3xl font-bold">
            {rank > 0 ? `#${rank}` : t("leaderboard.unranked")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{t("leaderboard.points")}</p>
          <p className="text-2xl font-bold text-primary">{points}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{t("leaderboard.participants")}</p>
          <p className="text-lg font-medium">{totalParticipants}</p>
        </div>
      </CardContent>
    </Card>
  );
}
