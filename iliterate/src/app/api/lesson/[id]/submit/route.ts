import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradeQuiz } from "@/lib/quiz-generator";
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

    const totalScore = gradeResult.readingScore + gradeResult.vocabularyScore;
    const totalMaxScore = gradeResult.readingMaxScore + gradeResult.vocabularyMaxScore;
    const percentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    // Calculate level adjustment based on score
    let levelAdjustment = 0;
    if (percentage >= 80) {
      levelAdjustment = 1; // Did well, increase difficulty
    } else if (percentage < 50) {
      levelAdjustment = -1; // Struggled, decrease difficulty
    }
    // 50-79%: stay at same level

    // Calculate XP awards
    const baseReadingXP = Math.floor((gradeResult.readingScore / Math.max(gradeResult.readingMaxScore, 1)) * 30);
    const baseVocabXP = Math.floor((gradeResult.vocabularyScore / Math.max(gradeResult.vocabularyMaxScore, 1)) * 20);

    // Bonus XP for perfect scores
    const perfectBonus = totalScore === totalMaxScore ? 10 : 0;

    const readingXpAwarded = baseReadingXP + (totalScore === totalMaxScore ? 5 : 0);
    const vocabularyXpAwarded = baseVocabXP + (totalScore === totalMaxScore ? 5 : 0);

    // Update lesson with results
    const { error: updateError } = await supabase
      .from("lesson_sessions")
      .update({
        status: "completed",
        quiz_score: totalScore,
        quiz_max_score: totalMaxScore,
        reading_xp_awarded: readingXpAwarded,
        vocabulary_xp_awarded: vocabularyXpAwarded,
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
    const { data: skillLevels, error: skillError } = await supabase
      .from("user_skill_levels")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (skillLevels) {
      const newReadingXP = (skillLevels.reading_xp || 0) + readingXpAwarded;
      const newVocabularyXP = (skillLevels.vocabulary_xp || 0) + vocabularyXpAwarded;

      // Check for level ups (simple threshold: 100 XP per level)
      const xpPerLevel = 100;
      const newReadingLevel = Math.min(20, skillLevels.reading_level + Math.floor(newReadingXP / xpPerLevel));
      const newVocabularyLevel = Math.min(20, skillLevels.vocabulary_level + Math.floor(newVocabularyXP / xpPerLevel));

      await supabase
        .from("user_skill_levels")
        .update({
          reading_xp: newReadingXP % xpPerLevel,
          vocabulary_xp: newVocabularyXP % xpPerLevel,
          reading_level: newReadingLevel,
          vocabulary_level: newVocabularyLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      results: {
        gradedQuestions: gradeResult.gradedQuestions,
        readingScore: gradeResult.readingScore,
        readingMaxScore: gradeResult.readingMaxScore,
        vocabularyScore: gradeResult.vocabularyScore,
        vocabularyMaxScore: gradeResult.vocabularyMaxScore,
        totalScore,
        totalMaxScore,
        percentage: Math.round(percentage),
        levelAdjustment,
        xpAwarded: {
          reading: readingXpAwarded,
          vocabulary: vocabularyXpAwarded,
          total: readingXpAwarded + vocabularyXpAwarded,
        },
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
