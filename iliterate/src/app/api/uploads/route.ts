import { NextResponse } from "next/server";
import { z } from "zod";

import { detectContentMetadata } from "@/lib/google-ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  SUPPORTED_UPLOAD_MIME_TYPES,
  UPLOADS_BUCKET,
  buildStoragePath,
  extractUploadPayload,
  inferUploadKind,
  type UploadScope,
} from "@/lib/uploads";

const uploadSchema = z.object({
  scope: z.enum(["content_import", "study_chat", "dm_attachment"]),
});

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const scopeValue = formData.get("scope");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!file.type || !SUPPORTED_UPLOAD_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File must be between 1 byte and 15 MB" },
        { status: 400 }
      );
    }

    const parsed = uploadSchema.safeParse({
      scope: scopeValue,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid upload scope" },
        { status: 400 }
      );
    }

    const scope = parsed.data.scope as UploadScope;
    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();
    const storagePath = buildStoragePath(scope, user.id, file.name);
    const mimeType = file.type || "application/octet-stream";
    const uploadKind = inferUploadKind(mimeType, file.name);

    const { error: storageError } = await admin.storage
      .from(UPLOADS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (storageError) {
      throw storageError;
    }

    const extracted = await extractUploadPayload({
      buffer,
      filename: file.name,
      mimeType,
    });
    const detectedMetadata =
      extracted.text && extracted.text.trim().length > 0
        ? await detectContentMetadata(extracted.text).catch(() => null)
        : null;

    const { data, error } = await supabase
      .from("user_uploads")
      .insert({
        user_id: user.id,
        scope,
        kind: uploadKind,
        storage_path: storagePath,
        extracted_text: extracted.text,
        language_detected: detectedMetadata?.language ?? null,
        processed_at:
          extracted.status === "processed" ? new Date().toISOString() : null,
        original_filename: file.name,
        mime_type: extracted.mimeType,
        file_size_bytes: file.size,
        status: extracted.status,
        title: extracted.title,
        metadata: {},
      })
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("Failed to save upload");
    }

    const { data: signedData } = await admin.storage
      .from(UPLOADS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

    return NextResponse.json({
      id: data.id,
      storagePath: data.storage_path,
      mimeType: data.mime_type,
      title: data.title,
      scope: data.scope,
      status: data.status,
      kind: data.kind,
      fileName: data.original_filename,
      fileSizeBytes: data.file_size_bytes,
      extractedText: data.extracted_text,
      languageDetected: data.language_detected,
      signedUrl: signedData?.signedUrl ?? null,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 }
    );
  }
}
