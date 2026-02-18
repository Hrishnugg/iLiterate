import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuizFromContent } from "@/lib/quiz-generator";
import { LENGTH_CONFIG, LessonLength } from "@/lib/lesson-generator";

/**
 * POST /api/lesson/[id]/complete-reading - Mark reading as complete and generate quiz
 */
export async function POST(
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

    // Get the lesson
    const { data: lesson, error: lessonError } = await supabase
      .from("lesson_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (lesson.status !== "reading") {
      return NextResponse.json(
        { error: "Reading already completed" },
        { status: 400 }
      );
    }

    // Get user's profile for native language
    const { data: profile } = await supabase
      .from("profiles")
      .select("target_language, native_language")
      .eq("id", user.id)
      .single();

    // Determine number of questions based on length
    const lengthConfig = LENGTH_CONFIG[lesson.length_type as LessonLength];
    let numComprehension = 2;
    let numVocabulary = 2;

    if (lesson.length_type === "medium") {
      numComprehension = 3;
      numVocabulary = 2;
    } else if (lesson.length_type === "long") {
      numComprehension = 4;
      numVocabulary = 4;
    }

    // Generate quiz questions
    const quizQuestions = await generateQuizFromContent(
      lesson.content_body,
      lesson.target_level,
      profile?.target_language || "spanish",
      profile?.native_language || "english",
      lesson.vocabulary || [],
      numComprehension,
      numVocabulary
    );

    // Update lesson status
    const { error: updateError } = await supabase
      .from("lesson_sessions")
      .update({
        status: "quiz",
        reading_completed_at: new Date().toISOString(),
        quiz_questions: quizQuestions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update lesson:", updateError);
      return NextResponse.json(
        { error: "Failed to update lesson" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quizQuestions,
      message: "Reading completed! Take the quiz to earn XP.",
    });
  } catch (error) {
    console.error("Complete reading error:", error);
    return NextResponse.json(
      { error: "Failed to complete reading" },
      { status: 500 }
    );
  }
}
