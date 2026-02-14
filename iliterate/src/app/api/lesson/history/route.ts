import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTopicInfo } from "@/lib/lesson-generator";

/**
 * GET /api/lesson/history - Get user's lesson history
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

    // Get query params for pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status"); // Optional filter

    // Build query
    let query = supabase
      .from("lesson_sessions")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: lessons, error, count } = await query;

    if (error) {
      console.error("Failed to fetch lesson history:", error);
      return NextResponse.json(
        { error: "Failed to fetch lesson history" },
        { status: 500 }
      );
    }

    // Transform lessons for response
    const transformedLessons = (lessons || []).map((lesson) => {
      const topicInfo = getTopicInfo(lesson.topic);
      const percentage = lesson.quiz_max_score > 0
        ? Math.round((lesson.quiz_score / lesson.quiz_max_score) * 100)
        : null;

      return {
        id: lesson.id,
        title: lesson.title,
        topic: topicInfo,
        targetLevel: lesson.target_level,
        length: lesson.length_type,
        wordCount: lesson.word_count,
        status: lesson.status,
        quizScore: lesson.quiz_score,
        quizMaxScore: lesson.quiz_max_score,
        percentage,
        levelAdjustment: lesson.level_adjustment,
        readingXpAwarded: lesson.reading_xp_awarded,
        vocabularyXpAwarded: lesson.vocabulary_xp_awarded,
        createdAt: lesson.created_at,
        completedAt: lesson.completed_at,
      };
    });

    // Get stats
    const completedLessons = (lessons || []).filter(l => l.status === "completed");
    const totalXP = completedLessons.reduce(
      (sum, l) => sum + (l.reading_xp_awarded || 0) + (l.vocabulary_xp_awarded || 0),
      0
    );
    const avgScore = completedLessons.length > 0
      ? Math.round(
          completedLessons.reduce(
            (sum, l) => sum + (l.quiz_max_score > 0 ? (l.quiz_score / l.quiz_max_score) * 100 : 0),
            0
          ) / completedLessons.length
        )
      : 0;

    return NextResponse.json({
      lessons: transformedLessons,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
      stats: {
        totalLessons: count || 0,
        completedLessons: completedLessons.length,
        totalXP,
        averageScore: avgScore,
      },
    });
  } catch (error) {
    console.error("Lesson history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lesson history" },
      { status: 500 }
    );
  }
}
