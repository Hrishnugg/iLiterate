import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { highlightRequestSchema, uuidSchema, validateRequestBody } from "@/lib/validations";

// GET /api/highlights?contentId=xxx or ?lessonId=xxx
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
    const lessonId = searchParams.get("lessonId");

    // Validate IDs if provided
    if (contentId) {
      const result = uuidSchema.safeParse(contentId);
      if (!result.success) {
        return NextResponse.json({ error: "Invalid contentId format" }, { status: 400 });
      }
    }
    if (lessonId) {
      const result = uuidSchema.safeParse(lessonId);
      if (!result.success) {
        return NextResponse.json({ error: "Invalid lessonId format" }, { status: 400 });
      }
    }

    let query = supabase
      .from("highlights")
      .select("*")
      .eq("user_id", user.id)
      .order("start_position", { ascending: true });

    if (contentId) {
      query = query.eq("content_id", contentId);
    } else if (lessonId) {
      query = query.eq("lesson_id", lessonId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch highlights" }, { status: 500 });
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

    // Validate request body
    const { data: body, error: validationError } = await validateRequestBody(
      request,
      highlightRequestSchema
    );

    if (validationError || !body) {
      return NextResponse.json({ error: validationError || "Invalid request body" }, { status: 400 });
    }

    const {
      contentId,
      lessonId,
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

    const { data, error } = await supabase
      .from("highlights")
      .insert({
        user_id: user.id,
        content_id: contentId || null,
        lesson_id: lessonId || null,
        position_type: positionType,
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
      return NextResponse.json({ error: "Failed to create highlight" }, { status: 500 });
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
