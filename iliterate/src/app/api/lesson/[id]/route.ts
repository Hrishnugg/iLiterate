import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTopicInfo } from "@/lib/lesson-generator";

/**
 * GET /api/lesson/[id] - Get lesson details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: lesson, error } = await supabase
      .from("lesson_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get user's target language
    const { data: profile } = await supabase
      .from("profiles")
      .select("target_language")
      .eq("id", user.id)
      .single();

    const topicInfo = getTopicInfo(lesson.topics?.[0]);

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        body: lesson.content_body,
        targetLevel: lesson.target_level,
        language: profile?.target_language || "spanish",
        topic: topicInfo,
        length: lesson.length_type,
        wordCount: lesson.word_count,
        vocabulary: lesson.vocabulary,
        status: lesson.status,
        quizQuestions: lesson.quiz_questions,
        quizScore: lesson.quiz_score,
        quizMaxScore: lesson.quiz_max_score,
        readingXpAwarded: lesson.reading_xp_awarded,
        vocabularyXpAwarded: lesson.vocabulary_xp_awarded,
        levelAdjustment: lesson.level_adjustment,
        createdAt: lesson.created_at,
        readingCompletedAt: lesson.reading_completed_at,
      },
    });
  } catch (error) {
    console.error("Get lesson error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lesson" },
      { status: 500 }
    );
  }
}
