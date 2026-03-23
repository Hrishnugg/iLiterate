import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { extractUploadPreview } from "@/lib/content-imports";
import { createClient } from "@/lib/supabase/server";

const importUploadSchema = z.object({
  uploadId: z.string().uuid(),
});

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
    const parsed = importUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid upload" },
        { status: 400 }
      );
    }

    const { data: upload, error: uploadError } = await supabase
      .from("user_uploads")
      .select("*")
      .eq("id", parsed.data.uploadId)
      .eq("user_id", user.id)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const preview = await extractUploadPreview(upload);

    await supabase
      .from("user_uploads")
      .update({
        title: preview.title,
        extracted_text: preview.extractedText,
        language_detected: preview.language,
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", upload.id)
      .eq("user_id", user.id);

    return NextResponse.json({
      sourceUploadId: preview.sourceUploadId,
      uploadKind: preview.uploadKind,
      title: preview.title,
      extractedText: preview.extractedText,
      language: preview.language,
      difficulty: preview.difficulty,
      suggestedContentType: preview.suggestedContentType,
      contentTypeOptions: preview.contentTypeOptions,
      previewUrl: preview.previewUrl,
    });
  } catch (error) {
    console.error("Import upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare upload for import",
      },
      { status: 500 }
    );
  }
}
