import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("streaks")
      .select(
        "current_streak, longest_streak, last_activity_date, streak_start_date"
      )
      .eq("user_id", user.id)
      .single();

    if (error) {
      // No streak row yet
      if (error.code === "PGRST116") {
        return NextResponse.json({
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null,
          streakStartDate: null,
        });
      }
      console.error("Failed to fetch streak:", error);
      return NextResponse.json(
        { error: "Failed to fetch streak" },
        { status: 500 }
      );
    }

    // Display-side lapse detection: if last activity is not today or yesterday,
    // the streak is stale and will reset on next activity — show 0.
    let displayStreak = data.current_streak ?? 0;
    if (data.last_activity_date) {
      const last = new Date(data.last_activity_date + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays > 1) {
        displayStreak = 0;
      }
    }

    return NextResponse.json({
      currentStreak: displayStreak,
      longestStreak: data.longest_streak ?? 0,
      lastActivityDate: data.last_activity_date,
      streakStartDate: data.streak_start_date,
    });
  } catch (error) {
    console.error("Streak API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch streak" },
      { status: 500 }
    );
  }
}
