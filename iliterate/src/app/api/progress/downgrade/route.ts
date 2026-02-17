import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDowngradedLevel, getPreviousCEFRTier } from "@/lib/level-system";
import { numericLevelToCEFR } from "@/types/database";

interface DowngradeRequest {
  clearInProgressLessons: boolean;
}

/**
 * POST /api/progress/downgrade
 * Downgrade user's skill levels by one CEFR tier
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

    // Parse request body
    const body: DowngradeRequest = await request.json();
    const { clearInProgressLessons } = body;

    // Get current skill levels
    const { data: skillLevels, error: skillError } = await supabase
      .from("user_skill_levels")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (skillError || !skillLevels) {
      return NextResponse.json(
        { error: "Skill levels not found" },
        { status: 404 }
      );
    }

    // Check if user can downgrade (based on reading level as primary)
    const currentReadingLevel = skillLevels.reading_level;
    const targetLevel = getDowngradedLevel(currentReadingLevel);

    if (targetLevel === null) {
      return NextResponse.json(
        { error: "Already at the lowest tier (A1). Cannot downgrade further." },
        { status: 400 }
      );
    }

    // Calculate old and new CEFR levels
    const oldCEFR = numericLevelToCEFR(currentReadingLevel);
    const newCEFR = getPreviousCEFRTier(currentReadingLevel);

    // Store old levels for response
    const oldLevels = {
      reading: skillLevels.reading_level,
      vocabulary: skillLevels.vocabulary_level,
      grammar: skillLevels.grammar_level,
    };

    // Calculate new levels for each skill
    // If skill is at or above the current tier minimum, drop to target tier max
    // Otherwise, reduce proportionally
    const newLevels = {
      reading: targetLevel,
      vocabulary: Math.max(1, Math.min(targetLevel, skillLevels.vocabulary_level)),
      grammar: Math.max(1, Math.min(targetLevel, skillLevels.grammar_level)),
    };

    // Update skill levels (reset XP to 0)
    const { error: updateError } = await supabase
      .from("user_skill_levels")
      .update({
        reading_level: newLevels.reading,
        vocabulary_level: newLevels.vocabulary,
        grammar_level: newLevels.grammar,
        reading_xp: 0,
        vocabulary_xp: 0,
        grammar_xp: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update skill levels:", updateError);
      return NextResponse.json(
        { error: "Failed to downgrade levels" },
        { status: 500 }
      );
    }

    // Clear in-progress lessons if requested
    let lessonsCleared = 0;
    if (clearInProgressLessons) {
      const { data: deletedLessons, error: deleteError } = await supabase
        .from("lesson_sessions")
        .delete()
        .eq("user_id", user.id)
        .in("status", ["reading", "quiz"])
        .select("id");

      if (deleteError) {
        console.error("Failed to clear lessons:", deleteError);
        // Don't fail the request, just log it
      } else {
        lessonsCleared = deletedLessons?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      oldLevels,
      newLevels,
      oldCEFR,
      newCEFR,
      lessonsCleared,
    });
  } catch (error) {
    console.error("Downgrade error:", error);
    return NextResponse.json(
      { error: "Failed to process downgrade request" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/progress/downgrade
 * Check if user can downgrade and get preview info
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

    // Get current skill levels
    const { data: skillLevels, error: skillError } = await supabase
      .from("user_skill_levels")
      .select("reading_level, vocabulary_level, grammar_level")
      .eq("user_id", user.id)
      .single();

    if (skillError || !skillLevels) {
      return NextResponse.json(
        { error: "Skill levels not found" },
        { status: 404 }
      );
    }

    // Check if downgrade is possible
    const currentLevel = skillLevels.reading_level;
    const targetLevel = getDowngradedLevel(currentLevel);
    const canDowngrade = targetLevel !== null;

    // Count in-progress lessons
    const { count: inProgressCount } = await supabase
      .from("lesson_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["reading", "quiz"]);

    return NextResponse.json({
      canDowngrade,
      currentLevel,
      currentCEFR: numericLevelToCEFR(currentLevel),
      targetLevel: targetLevel ?? currentLevel,
      targetCEFR: targetLevel ? numericLevelToCEFR(targetLevel) : numericLevelToCEFR(currentLevel),
      inProgressLessons: inProgressCount || 0,
    });
  } catch (error) {
    console.error("Downgrade check error:", error);
    return NextResponse.json(
      { error: "Failed to check downgrade status" },
      { status: 500 }
    );
  }
}
