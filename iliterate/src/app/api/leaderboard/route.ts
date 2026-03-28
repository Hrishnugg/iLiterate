import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/leaderboard?period=weekly|monthly&scope=global|friends&limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "weekly";
    const scope = searchParams.get("scope") || "global";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Compute period_start
    const now = new Date();
    let periodStart: Date;

    if (period === "monthly") {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // Weekly: Monday of current week
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - diff);
      periodStart.setHours(0, 0, 0, 0);
    }

    // Fetch leaderboard entries
    const isFriends = scope === "friends";
    const { data: entries, error: lbError } = await supabase.rpc(
      isFriends ? "get_friends_leaderboard" : "get_leaderboard",
      isFriends
        ? { target_user_id: user.id, period_start: periodStart.toISOString(), lim: limit, off: offset }
        : { period_start: periodStart.toISOString(), lim: limit, off: offset }
    );

    if (lbError) {
      console.error("Leaderboard query error:", lbError);
      return NextResponse.json(
        { error: "Failed to fetch leaderboard" },
        { status: 500 }
      );
    }

    // Fetch current user's rank
    const { data: userRank, error: rankError } = await supabase.rpc(
      isFriends ? "get_friends_leaderboard_user_rank" : "get_user_rank",
      {
        target_user_id: user.id,
        period_start: periodStart.toISOString(),
      }
    );

    if (rankError) {
      console.error("User rank query error:", rankError);
    }

    // Fetch total participants
    const { data: totalParticipants, error: countError } = await supabase.rpc(
      isFriends ? "get_friends_leaderboard_participant_count" : "get_leaderboard_participant_count",
      isFriends
        ? { target_user_id: user.id, period_start: periodStart.toISOString() }
        : { period_start: periodStart.toISOString() }
    );

    if (countError) {
      console.error("Participant count error:", countError);
    }

    const userIds = (entries || []).map((e: { user_id: string }) => e.user_id);
    const avatarMap: Record<string, { avatar_url: string | null; avatar_seed: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, avatar_url, avatar_seed")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        avatarMap[p.id] = { avatar_url: p.avatar_url, avatar_seed: p.avatar_seed };
      }
    }

    const formattedEntries = (entries || []).map(
      (e: { rank: number; user_id: string; display_name: string; total_points: number }) => ({
        rank: Number(e.rank),
        userId: e.user_id,
        displayName: e.display_name,
        points: Number(e.total_points),
        avatarUrl: avatarMap[e.user_id]?.avatar_url ?? null,
        avatarSeed: avatarMap[e.user_id]?.avatar_seed ?? null,
      })
    );

    const userEntry = userRank && userRank.length > 0
      ? { rank: Number(userRank[0].rank), points: Number(userRank[0].total_points) }
      : { rank: 0, points: 0 };

    return NextResponse.json({
      entries: formattedEntries,
      userEntry,
      totalParticipants: Number(totalParticipants ?? 0),
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
