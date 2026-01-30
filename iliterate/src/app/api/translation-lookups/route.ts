import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/translation-lookups?contentId=xxx
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
      .from("translation_lookups")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (contentId) {
      query = query.eq("content_id", contentId);
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

// DELETE /api/translation-lookups (clear all for content or specific)
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
    const id = searchParams.get("id");

    let query = supabase
      .from("translation_lookups")
      .delete()
      .eq("user_id", user.id);

    if (id) {
      query = query.eq("id", id);
    } else if (contentId) {
      query = query.eq("content_id", contentId);
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
