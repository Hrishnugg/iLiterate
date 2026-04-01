import { NextRequest, NextResponse } from "next/server";
import {
  countWords,
  estimateReadingTimeMinutes,
  formatImportedTextAsHtml,
} from "@/lib/content-imports";
import { UPLOADS_BUCKET } from "@/lib/uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const MAX_BODY_CHARS = 500_000;

const uploadSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(MAX_BODY_CHARS),
  language: z.string().min(2).max(10),
  difficulty_level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  content_type: z
    .enum(["article", "story", "news", "dialogue", "menu", "sign", "pdf", "epub"])
    .default("article"),
  source_url: z.string().url().optional(),
  source_upload_id: z.string().uuid().optional(),
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

  const contentRows = data ?? [];
  const uploadIds = Array.from(
    new Set(
      contentRows
        .map((row) => row.source_upload_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const uploadsById = new Map<
    string,
    { kind: string | null; thumbnail_url: string | null }
  >();

  if (uploadIds.length > 0) {
    const { data: uploads } = await supabase
      .from("user_uploads")
      .select("id, kind, storage_path")
      .in("id", uploadIds)
      .eq("user_id", user.id);

    const admin = createAdminClient();
    await Promise.all(
      (uploads ?? []).map(async (upload) => {
        const isImage = upload.kind === "image";
        let thumbnailUrl: string | null = null;

        if (isImage && typeof upload.storage_path === "string" && upload.storage_path.length > 0) {
          const { data: signedData } = await admin.storage
            .from(UPLOADS_BUCKET)
            .createSignedUrl(upload.storage_path, 60 * 60);
          thumbnailUrl = signedData?.signedUrl ?? null;
        }

        uploadsById.set(String(upload.id), {
          kind: typeof upload.kind === "string" ? upload.kind : null,
          thumbnail_url: thumbnailUrl,
        });
      })
    );
  }

  return NextResponse.json(
    contentRows.map((row) => {
      const upload = row.source_upload_id
        ? uploadsById.get(String(row.source_upload_id))
        : null;

      return {
        ...row,
        source_upload_kind: upload?.kind ?? null,
        thumbnail_url: upload?.thumbnail_url ?? null,
      };
    })
  );
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

  const {
    title,
    body: text,
    language,
    difficulty_level,
    content_type,
    source_url,
    source_upload_id,
  } = parsed.data;

  if (source_upload_id) {
    const { data: upload, error: uploadError } = await supabase
      .from("user_uploads")
      .select("id")
      .eq("id", source_upload_id)
      .eq("user_id", user.id)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: "Source upload not found" },
        { status: 404 }
      );
    }
  }

  const wordCount = countWords(text);
  const estimatedReadingTime = estimateReadingTimeMinutes(text);

  const { data, error } = await supabase
    .from("content")
    .insert({
      title,
      body: formatImportedTextAsHtml(text),
      language,
      difficulty_level,
      content_type,
      topic_tags: [],
      word_count: wordCount,
      estimated_reading_time: estimatedReadingTime,
      source_url: source_url ?? null,
      source_upload_id: source_upload_id ?? null,
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
