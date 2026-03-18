"use client";

import { useEffect, useState, useCallback } from "react";
import { Globe, Loader2, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [scope, setScope] = useState<"global" | "friends">("global");
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
    s: string,
    off: number,
    append: boolean = false
  ) => {
    try {
      if (!append) setIsLoading(true);
      const response = await fetch(
        `/api/leaderboard?period=${p}&scope=${s}&limit=${LIMIT}&offset=${off}`
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
    fetchLeaderboard(period, scope, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, scope]);

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchLeaderboard(period, scope, newOffset, true);
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
          {scope === "friends"
            ? "See how you rank among your friends"
            : "See how you rank against other learners"}
        </p>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as "global" | "friends")}>
        <TabsList>
          <TabsTrigger value="global" className="gap-1.5">
            <Globe className="h-4 w-4" />
            Global
          </TabsTrigger>
          <TabsTrigger value="friends" className="gap-1.5">
            <Users className="h-4 w-4" />
            Friends
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
      </Tabs>

      {data && (
        <LeaderboardTable
          entries={data.entries}
          currentUserId={currentUserId}
          emptyMessage={
            scope === "friends" ? (
              <span>
                No friend activity this period.{" "}
                <Link href="/social" className="text-primary underline underline-offset-4 hover:text-primary/80">
                  Find friends
                </Link>{" "}
                to compare scores!
              </span>
            ) : undefined
          }
        />
      )}

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
