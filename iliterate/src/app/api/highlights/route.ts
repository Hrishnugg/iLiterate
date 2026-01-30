import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/highlights?contentId=xxx
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

    let query = supabase
      .from("highlights")
      .select("*")
      .eq("user_id", user.id)
      .order("start_position", { ascending: true });

    if (contentId) {
      query = query.eq("content_id", contentId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get highlights error:", error);
    return NextResponse.json(
      { error: "Failed to fetch highlights" },
      { status: 500 }
    );
  }
}

// POST /api/highlights
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
    const {
      contentId,
      positionType,
      startPosition,
      endPosition,
      selectedText,
      contextBefore,
      contextAfter,
      note,
      translation,
      transliteration,
      partOfSpeech,
    } = body;

    if (!contentId || !startPosition || !endPosition || !selectedText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("highlights")
      .insert({
        user_id: user.id,
        content_id: contentId,
        position_type: positionType || "offset",
        start_position: String(startPosition),
        end_position: String(endPosition),
        selected_text: selectedText,
        context_before: contextBefore,
        context_after: contextAfter,
        note,
        translation,
        transliteration,
        part_of_speech: partOfSpeech,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Create highlight error:", error);
    return NextResponse.json(
      { error: "Failed to create highlight" },
      { status: 500 }
    );
  }
}
