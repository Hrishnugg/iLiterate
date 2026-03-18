import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradeQuiz } from "@/lib/quiz-generator";
import { awardPoints, calculateLessonPoints, calculatePerfectQuizBonus } from "@/lib/points";
import { z } from "zod";

const submitSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

/**
 * POST /api/lesson/[id]/submit - Submit quiz answers and get results
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

    // Parse request body
    const body = await request.json();
    const validationResult = submitSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { answers } = validationResult.data;

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

    if (lesson.status !== "quiz") {
      return NextResponse.json(
        { error: "Lesson is not in quiz state" },
        { status: 400 }
      );
    }

    if (!lesson.quiz_questions || lesson.quiz_questions.length === 0) {
      return NextResponse.json(
        { error: "No quiz questions found" },
        { status: 400 }
      );
    }

    // Grade the quiz
    const gradeResult = gradeQuiz(lesson.quiz_questions, answers);

    const { gradedQuestions, score, maxScore, percentage } = gradeResult;

    // Calculate level adjustment based on score
    let levelAdjustment = 0;
    if (percentage >= 80) {
      levelAdjustment = 1; // Did well, increase difficulty
    } else if (percentage < 50) {
      levelAdjustment = -1; // Struggled, decrease difficulty
    }
    // 50-79%: stay at same level

    // Calculate XP awards
    const baseXP = Math.floor((score / Math.max(maxScore, 1)) * 50);
    const perfectBonus = score === maxScore ? 10 : 0;
    const xpAwarded = baseXP + perfectBonus;

    // Update lesson with results
    const { error: updateError } = await supabase
      .from("lesson_sessions")
      .update({
        status: "completed",
        quiz_score: score,
        quiz_max_score: maxScore,
        reading_xp_awarded: xpAwarded,
        vocabulary_xp_awarded: 0,
        level_adjustment: levelAdjustment,
        quiz_answers: answers,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update lesson:", updateError);
      return NextResponse.json(
        { error: "Failed to save quiz results" },
        { status: 500 }
      );
    }

    // Update user's skill levels with XP
    const { data: skillLevels } = await supabase
      .from("user_skill_levels")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Award leaderboard points
    const lessonPts = calculateLessonPoints(percentage / 100);
    await awardPoints(supabase, user.id, lessonPts, "lesson_completion", id, {
      score,
      maxScore,
      percentage,
    });
    const perfectPts = calculatePerfectQuizBonus(score, maxScore);
    if (perfectPts > 0) {
      await awardPoints(supabase, user.id, perfectPts, "perfect_quiz", id);
    }

    if (skillLevels) {
      const newReadingXP = (skillLevels.reading_xp || 0) + xpAwarded;

      // Check for level ups (simple threshold: 100 XP per level)
      const xpPerLevel = 100;
      const newReadingLevel = Math.min(20, skillLevels.reading_level + Math.floor(newReadingXP / xpPerLevel));

      await supabase
        .from("user_skill_levels")
        .update({
          reading_xp: newReadingXP % xpPerLevel,
          reading_level: newReadingLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      results: {
        gradedQuestions,
        score,
        maxScore,
        percentage,
        levelAdjustment,
        xpAwarded,
      },
      message: levelAdjustment > 0
        ? "Great job! Your next lesson will be slightly more challenging."
        : levelAdjustment < 0
        ? "Keep practicing! Your next lesson will focus on reinforcing these concepts."
        : "Good work! You're ready for more content at this level.",
    });
  } catch (error) {
    console.error("Submit quiz error:", error);
    return NextResponse.json(
      { error: "Failed to submit quiz" },
      { status: 500 }
    );
  }
}
