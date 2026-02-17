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
      .map((p) => {
        const contentData = p.content as unknown;
        const content = contentData as { id: string; title: string; difficulty_level: string } | null;
        return {
          id: p.content_id,
          title: content?.title || "Untitled",
          difficulty_level: content?.difficulty_level || "A1",
          progress_percent: Math.round(p.progress_percent),
        };
      });

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

    const completedFromAssessments = (completedAssessments || []).map((a) => {
      const totalScore = (a.reading_score || 0) + (a.vocabulary_score || 0);
      const totalMax = (a.reading_max_score || 0) + (a.vocabulary_max_score || 0);
      const totalXP = (a.reading_xp_awarded || 0) + (a.vocabulary_xp_awarded || 0);
      const contentData = a.content as unknown;
      const content = contentData as { id: string; title: string } | null;

      return {
        id: a.id,
        content_id: a.content_id,
        content_title: content?.title || "Untitled",
        score_percent: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
        total_xp: totalXP,
        created_at: a.created_at,
        source: "content" as const,
      };
    });

    // Get completed lesson quizzes
    const { data: completedLessons } = await supabase
      .from("lesson_sessions")
      .select(`
        id,
        title,
        quiz_score,
        quiz_max_score,
        reading_xp_awarded,
        vocabulary_xp_awarded,
        completed_at
      `)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("quiz_score", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20);

    const completedFromLessons = (completedLessons || []).map((l) => {
      const totalXP = (l.reading_xp_awarded || 0) + (l.vocabulary_xp_awarded || 0);
      const totalMax = l.quiz_max_score || 0;
      const totalScore = l.quiz_score || 0;

      return {
        id: l.id,
        content_id: null,
        content_title: l.title || "Lesson Quiz",
        score_percent: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
        total_xp: totalXP,
        created_at: l.completed_at,
        source: "lesson" as const,
      };
    });

    // Merge and sort by date
    const completed = [...completedFromAssessments, ...completedFromLessons]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    return NextResponse.json({ pending, completed });
  } catch (error) {
    console.error("Failed to fetch quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}
