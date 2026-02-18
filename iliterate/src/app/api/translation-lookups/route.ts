import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/translation-lookups?contentId=xxx or ?lessonId=xxx
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

    let query = supabase
      .from("translation_lookups")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (contentId) {
      query = query.eq("content_id", contentId);
    } else if (lessonId) {
      query = query.eq("lesson_id", lessonId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get translation lookups error:", error);
    return NextResponse.json(
      { error: "Failed to fetch translation lookups" },
      { status: 500 }
    );
  }
}

// DELETE /api/translation-lookups (clear all for content/lesson or specific)
export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get("id");

    // Require either id, contentId, or lessonId to prevent accidental mass deletion
    if (!id && !contentId && !lessonId) {
      return NextResponse.json(
        { error: "Must provide 'id', 'contentId', or 'lessonId' parameter" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("translation_lookups")
      .delete()
      .eq("user_id", user.id);

    if (id) {
      query = query.eq("id", id);
    } else if (contentId) {
      query = query.eq("content_id", contentId);
    } else if (lessonId) {
      query = query.eq("lesson_id", lessonId);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete translation lookups error:", error);
    return NextResponse.json(
      { error: "Failed to delete translation lookups" },
      { status: 500 }
    );
  }
}
