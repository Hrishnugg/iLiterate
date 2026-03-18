"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Trophy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { UserRankCard } from "@/components/leaderboard/UserRankCard";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { createClient } from "@/lib/supabase/client";
import { LeaderboardEntry } from "@/types/database";

interface LeaderboardData {
  entries: LeaderboardEntry[];
  userEntry: { rank: number; points: number };
  totalParticipants: number;
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const LIMIT = 20;

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    getUser();
  }, []);

  const fetchLeaderboard = useCallback(async (
    p: string,
    off: number,
    append: boolean = false
  ) => {
    try {
      if (!append) setIsLoading(true);
      const response = await fetch(
        `/api/leaderboard?period=${p}&limit=${LIMIT}&offset=${off}`
      );
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      const result: LeaderboardData = await response.json();

      if (append && data) {
        setData({
          ...result,
          entries: [...data.entries, ...result.entries],
        });
      } else {
        setData(result);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  useEffect(() => {
    setOffset(0);
    fetchLeaderboard(period, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchLeaderboard(period, newOffset, true);
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground mt-1">
          See how you rank against other learners
        </p>
      </div>

      {data && (
        <UserRankCard
          rank={data.userEntry.rank}
          points={data.userEntry.points}
          totalParticipants={data.totalParticipants}
        />
      )}

      <Tabs value={period} onValueChange={(v) => setPeriod(v as "weekly" | "monthly")}>
        <TabsList>
          <TabsTrigger value="weekly">This Week</TabsTrigger>
          <TabsTrigger value="monthly">This Month</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          {data && (
            <LeaderboardTable
              entries={data.entries}
              currentUserId={currentUserId}
            />
          )}
        </TabsContent>

        <TabsContent value="monthly">
          {data && (
            <LeaderboardTable
              entries={data.entries}
              currentUserId={currentUserId}
            />
          )}
        </TabsContent>
      </Tabs>

      {data && data.entries.length >= offset + LIMIT && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
