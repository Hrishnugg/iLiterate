import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/quizzes - List pending and completed quizzes
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

    // Get content IDs that already have assessments
    const { data: assessments } = await supabase
      .from("skill_assessments")
      .select("content_id")
      .eq("user_id", user.id);

    const completedContentIds = new Set(
      assessments?.map((a) => a.content_id).filter(Boolean) || []
    );

    // Get reading progress for content read at least 80%
    const { data: progressData } = await supabase
      .from("reading_progress")
      .select(`
        content_id,
        progress_percent,
        content:content_id (
          id,
          title,
          difficulty_level
        )
      `)
      .eq("user_id", user.id)
      .gte("progress_percent", 80);

    // Filter to only content without assessments
    const pending = (progressData || [])
      .filter((p) => !completedContentIds.has(p.content_id))
      .map((p) => ({
        id: p.content_id,
        title: (p.content as { title: string })?.title || "Untitled",
        difficulty_level: (p.content as { difficulty_level: string })?.difficulty_level || "A1",
        progress_percent: Math.round(p.progress_percent),
      }));

    // Get completed assessments with content info
    const { data: completedAssessments } = await supabase
      .from("skill_assessments")
      .select(`
        id,
        content_id,
        reading_score,
        reading_max_score,
        vocabulary_score,
        vocabulary_max_score,
        reading_xp_awarded,
        vocabulary_xp_awarded,
        created_at,
        content:content_id (
          id,
          title
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const completed = (completedAssessments || []).map((a) => {
      const totalScore = (a.reading_score || 0) + (a.vocabulary_score || 0);
      const totalMax = (a.reading_max_score || 0) + (a.vocabulary_max_score || 0);
      const totalXP = (a.reading_xp_awarded || 0) + (a.vocabulary_xp_awarded || 0);

      return {
        id: a.id,
        content_id: a.content_id,
        content_title: (a.content as { title: string })?.title || "Untitled",
        score_percent: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
        total_xp: totalXP,
        created_at: a.created_at,
      };
    });

    return NextResponse.json({ pending, completed });
  } catch (error) {
    console.error("Failed to fetch quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}
