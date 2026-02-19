import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradeQuiz } from "@/lib/quiz-generator";
import { calculateQuizXP, checkLevelUp } from "@/lib/level-system";
import { z } from "zod";
import { AssessmentQuestion, SkillType, LevelChange } from "@/types/database";

const submitQuizSchema = z.object({
  contentId: z.string().uuid(),
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      question: z.string(),
      options: z.array(z.string()).optional(),
      correct_answer: z.string(),
      context: z.string().optional(),
      hint: z.string().optional(),
    })
  ),
  answers: z.record(z.string(), z.string()),
  timeTakenSeconds: z.number().min(0),
});

/**
 * POST /api/quiz/submit - Submit quiz answers and update progress
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = submitQuizSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { contentId, questions, answers, timeTakenSeconds } =
      validationResult.data;

    // Get content for level info
    const { data: content } = await supabase
      .from("content")
      .select("numeric_level, difficulty_level, title")
      .eq("id", contentId)
      .single();

    const contentLevel = content?.numeric_level || 5;

    // Get current skill levels
    let { data: skillLevels } = await supabase
      .from("user_skill_levels")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Create skill levels if they don't exist
    if (!skillLevels) {
      const { data: newSkillLevels, error: createError } = await supabase
        .from("user_skill_levels")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: "Failed to initialize skill levels" },
          { status: 500 }
        );
      }
      skillLevels = newSkillLevels;
    }

    // Grade the quiz
    const { gradedQuestions, score, maxScore, percentage } = gradeQuiz(
      questions as AssessmentQuestion[],
      answers
    );

    // Calculate XP awards based on overall score
    const xpResult = calculateQuizXP(
      score,
      maxScore,
      contentLevel,
      skillLevels.reading_level,
      "reading"
    );

    // Check for level up
    const levelResult = checkLevelUp(
      skillLevels.reading_level,
      skillLevels.reading_xp,
      xpResult.totalXP
    );

    // Build level changes object
    const levelChanges: Partial<Record<SkillType, LevelChange>> = {};
    if (levelResult.leveledUp) {
      levelChanges.reading = {
        from: skillLevels.reading_level,
        to: levelResult.newLevel,
      };
    }

    // Update skill levels in database
    const { error: updateError } = await supabase
      .from("user_skill_levels")
      .update({
        reading_level: levelResult.newLevel,
        reading_xp: levelResult.remainingXP,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update skill levels:", updateError);
      return NextResponse.json(
        { error: "Failed to update progress" },
        { status: 500 }
      );
    }

    // Save assessment record
    const { data: assessment, error: assessmentError } = await supabase
      .from("skill_assessments")
      .insert({
        user_id: user.id,
        content_id: contentId,
        assessment_type: "post_reading",
        questions: gradedQuestions,
        reading_score: score,
        reading_max_score: maxScore,
        vocabulary_score: 0,
        vocabulary_max_score: 0,
        reading_xp_awarded: xpResult.totalXP,
        vocabulary_xp_awarded: 0,
        grammar_xp_awarded: 0,
        level_changes: Object.keys(levelChanges).length > 0 ? levelChanges : null,
        time_taken_seconds: timeTakenSeconds,
      })
      .select()
      .single();

    if (assessmentError) {
      console.error("Failed to save assessment:", assessmentError);
      // Don't fail the request, the levels are already updated
    }

    return NextResponse.json({
      success: true,
      assessment: {
        id: assessment?.id,
        contentId,
        contentTitle: content?.title,
      },
      results: {
        score,
        maxScore,
        percentage,
        xpAwarded: xpResult,
        levelUp: levelResult.leveledUp
          ? {
              from: skillLevels.reading_level,
              to: levelResult.newLevel,
              newCEFR: levelResult.newCEFR,
              crossedCEFRBoundary: levelResult.crossedCEFRBoundary,
            }
          : null,
      },
      gradedQuestions,
      newLevels: {
        reading: levelResult.newLevel,
        vocabulary: skillLevels.vocabulary_level,
        grammar: skillLevels.grammar_level,
      },
    });
  } catch (error) {
    console.error("Quiz submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit quiz" },
      { status: 500 }
    );
  }
}
