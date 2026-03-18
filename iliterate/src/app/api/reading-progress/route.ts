import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readingProgressRequestSchema, uuidSchema, validateRequestBody } from "@/lib/validations";
import { awardPoints, calculateReadingPoints } from "@/lib/points";

// GET /api/reading-progress?contentId=xxx
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

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId");

    if (!contentId) {
      return NextResponse.json(
        { error: "Missing contentId parameter" },
        { status: 400 }
      );
    }

    // Validate contentId format
    const uuidResult = uuidSchema.safeParse(contentId);
    if (!uuidResult.success) {
      return NextResponse.json({ error: "Invalid contentId format" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("reading_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      return NextResponse.json({ error: "Failed to fetch reading progress" }, { status: 500 });
    }

    return NextResponse.json(
      data || {
        user_id: user.id,
        content_id: contentId,
        last_position: 0,
        progress_percentage: 0,
      }
    );
  } catch (error) {
    console.error("Get reading progress error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reading progress" },
      { status: 500 }
    );
  }
}

// POST /api/reading-progress - Create or update progress
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

    // Validate request body
    const { data: body, error: validationError } = await validateRequestBody(
      request,
      readingProgressRequestSchema
    );

    if (validationError || !body) {
      return NextResponse.json({ error: validationError || "Invalid request body" }, { status: 400 });
    }

    const { contentId, progress, position, wordsRead } = body;

    // Check if progress exists
    const { data: existing } = await supabase
      .from("reading_progress")
      .select("id, completed_at")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .single();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that are provided
    if (position !== undefined) updates.last_position = position;
    if (progress !== undefined) updates.progress_percentage = progress;
    if (wordsRead !== undefined) updates.words_read = wordsRead;

    // Mark as completed if progress >= 95%
    if (progress !== undefined && progress >= 95 && !existing?.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from("reading_progress")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      // Create new
      result = await supabase
        .from("reading_progress")
        .insert({
          user_id: user.id,
          content_id: contentId,
          ...updates,
        })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: "Failed to save reading progress" }, { status: 500 });
    }

    // Award points on first completion (>=95%)
    if (
      progress !== undefined &&
      progress >= 95 &&
      !existing?.completed_at
    ) {
      const wordCount = wordsRead ?? 0;
      const pts = calculateReadingPoints(wordCount);
      await awardPoints(supabase, user.id, pts, "reading_completion", contentId, {
        progress,
        wordCount,
      });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Save reading progress error:", error);
    return NextResponse.json(
      { error: "Failed to save reading progress" },
      { status: 500 }
    );
  }
}
