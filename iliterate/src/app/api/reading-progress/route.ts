import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data, error } = await supabase
      .from("reading_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    const body = await request.json();
    const { contentId, progress, position, wordsRead } = body;

    if (!contentId) {
      return NextResponse.json(
        { error: "Missing contentId" },
        { status: 400 }
      );
    }

    // Check if progress exists
    const { data: existing } = await supabase
      .from("reading_progress")
      .select("id, completed_at")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .single();

    const updates = {
      last_position: position,
      progress_percentage: progress,
      words_read: wordsRead,
      updated_at: new Date().toISOString(),
    };

    // Mark as completed if progress >= 95%
    if (progress >= 95 && !existing?.completed_at) {
      Object.assign(updates, { completed_at: new Date().toISOString() });
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
      return NextResponse.json({ error: result.error.message }, { status: 500 });
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
