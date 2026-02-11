import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  calculateWeightedOverallLevel,
  getLevelProgress,
  getXPToNextLevel,
} from "@/lib/level-system";
import { numericLevelToCEFR } from "@/types/database";

// Validation schema for updating weights
const updateWeightsSchema = z
  .object({
    reading_weight: z.number().min(0).max(1),
    vocabulary_weight: z.number().min(0).max(1),
    grammar_weight: z.number().min(0).max(1),
  })
  .refine(
    (data) =>
      Math.abs(
        data.reading_weight + data.vocabulary_weight + data.grammar_weight - 1
      ) < 0.02,
    { message: "Weights must sum to 1" }
  );

/**
 * GET /api/progress - Get user's skill levels and progress
 */
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

    // Get or create skill levels
    let { data: skillLevels } = await supabase
      .from("user_skill_levels")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Create default skill levels if not exists
    if (!skillLevels) {
      const { data: newSkillLevels, error: createError } = await supabase
        .from("user_skill_levels")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create skill levels:", createError);
        return NextResponse.json(
          { error: "Failed to initialize skill levels" },
          { status: 500 }
        );
      }
      skillLevels = newSkillLevels;
    }

    // Get recent assessments
    const { data: recentAssessments } = await supabase
      .from("skill_assessments")
      .select(
        `
        *,
        content:content_id (id, title, difficulty_level)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate additional progress info
    const overallLevel = calculateWeightedOverallLevel(skillLevels);
    const overallCEFR = numericLevelToCEFR(overallLevel);

    const progressInfo = {
      reading: {
        level: skillLevels.reading_level,
        xp: skillLevels.reading_xp,
        xpToNext: getXPToNextLevel(skillLevels.reading_level),
        progress: getLevelProgress(
          skillLevels.reading_level,
          skillLevels.reading_xp
        ),
        cefr: numericLevelToCEFR(skillLevels.reading_level),
        weight: skillLevels.reading_weight,
      },
      vocabulary: {
        level: skillLevels.vocabulary_level,
        xp: skillLevels.vocabulary_xp,
        xpToNext: getXPToNextLevel(skillLevels.vocabulary_level),
        progress: getLevelProgress(
          skillLevels.vocabulary_level,
          skillLevels.vocabulary_xp
        ),
        cefr: numericLevelToCEFR(skillLevels.vocabulary_level),
        weight: skillLevels.vocabulary_weight,
      },
      grammar: {
        level: skillLevels.grammar_level,
        xp: skillLevels.grammar_xp,
        xpToNext: getXPToNextLevel(skillLevels.grammar_level),
        progress: getLevelProgress(
          skillLevels.grammar_level,
          skillLevels.grammar_xp
        ),
        cefr: numericLevelToCEFR(skillLevels.grammar_level),
        weight: skillLevels.grammar_weight,
      },
      overall: {
        level: overallLevel,
        cefr: overallCEFR,
      },
    };

    return NextResponse.json({
      skillLevels,
      progressInfo,
      recentAssessments: recentAssessments || [],
    });
  } catch (error) {
    console.error("Get progress error:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/progress - Update skill weights
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateWeightsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { reading_weight, vocabulary_weight, grammar_weight } =
      validationResult.data;

    // Update weights
    const { data, error } = await supabase
      .from("user_skill_levels")
      .update({
        reading_weight,
        vocabulary_weight,
        grammar_weight,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      // If no row exists, create one with the new weights
      if (error.code === "PGRST116") {
        const { data: newData, error: insertError } = await supabase
          .from("user_skill_levels")
          .insert({
            user_id: user.id,
            reading_weight,
            vocabulary_weight,
            grammar_weight,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Failed to create skill levels:", insertError);
          return NextResponse.json(
            { error: "Failed to update weights" },
            { status: 500 }
          );
        }

        return NextResponse.json(newData);
      }

      console.error("Failed to update weights:", error);
      return NextResponse.json(
        { error: "Failed to update weights" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update progress error:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
