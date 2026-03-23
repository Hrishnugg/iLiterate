import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validations";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  language: z.string().min(2).max(10).optional(),
  difficulty_level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
});

// GET /api/content/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Validate UUID format
    const uuidResult = uuidSchema.safeParse(id);
    if (!uuidResult.success) {
      return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Content not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get content error:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}

// PATCH /api/content/:id — update title, language, or difficulty_level
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const uuidResult = uuidSchema.safeParse(id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("content")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, language, difficulty_level, estimated_reading_time, word_count, created_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update content" }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/content/:id — remove user-uploaded content
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const uuidResult = uuidSchema.safeParse(id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("content")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete content" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
