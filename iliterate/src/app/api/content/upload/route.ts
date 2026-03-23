import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const MAX_BODY_CHARS = 100_000;

const uploadSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(MAX_BODY_CHARS),
  language: z.string().min(2).max(10),
  difficulty_level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
});

// GET /api/content/upload — fetch the authenticated user's uploaded content
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// POST /api/content/upload — save user-uploaded content
export async function POST(request: NextRequest) {
  const supabase = await createClient();
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

  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { title, body: text, language, difficulty_level } = parsed.data;

  const wordCount = text.trim().split(/\s+/).length;
  const estimatedReadingTime = Math.max(1, Math.round(wordCount / 200));

  const { data, error } = await supabase
    .from("content")
    .insert({
      title,
      body: text,
      language,
      difficulty_level,
      content_type: "pdf",
      topic_tags: [],
      word_count: wordCount,
      estimated_reading_time: estimatedReadingTime,
      is_generated: false,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Upload content error:", error);
    return NextResponse.json({ error: "Failed to save content" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
