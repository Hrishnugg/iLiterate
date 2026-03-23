import { NextResponse } from "next/server";
import mammoth from "mammoth";

import { UPLOADS_BUCKET } from "@/lib/uploads";
import {
  createAdminClient,
  getSignedUploadUrl,
} from "@/lib/social/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    attachmentId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { attachmentId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: attachmentRow, error: attachmentError } = await supabase
      .from("direct_message_attachments")
      .select(
        "id, upload_id, attachment_type, file_name, mime_type, extracted_text, detected_language"
      )
      .eq("id", attachmentId)
      .single();

    if (attachmentError || !attachmentRow) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const admin = createAdminClient();
    const { data: uploadRow, error: uploadError } = await admin
      .from("user_uploads")
      .select("storage_path, mime_type, extracted_text")
      .eq("id", attachmentRow.upload_id)
      .single();

    if (uploadError || !uploadRow?.storage_path) {
      return NextResponse.json(
        { error: "Attachment storage record is unavailable" },
        { status: 404 }
      );
    }

    const storagePath = String(uploadRow.storage_path);
    const signedUrl = await getSignedUploadUrl(storagePath, 60 * 30);
    let previewHtml: string | null = null;

    if (attachmentRow.attachment_type === "docx") {
      const { data: fileBlob, error: fileError } = await admin.storage
        .from(UPLOADS_BUCKET)
        .download(storagePath);

      if (fileError || !fileBlob) {
        throw fileError ?? new Error("Failed to load document preview");
      }

      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      const result = await mammoth.convertToHtml({ buffer });
      previewHtml = result.value.trim() || null;
    }

    return NextResponse.json({
      id: attachmentRow.id,
      attachmentType: attachmentRow.attachment_type,
      fileName:
        typeof attachmentRow.file_name === "string"
          ? attachmentRow.file_name
          : null,
      mimeType:
        typeof attachmentRow.mime_type === "string"
          ? attachmentRow.mime_type
          : typeof uploadRow.mime_type === "string"
            ? uploadRow.mime_type
            : null,
      url: signedUrl,
      previewHtml,
      previewText:
        typeof attachmentRow.extracted_text === "string"
          ? attachmentRow.extracted_text
          : typeof uploadRow.extracted_text === "string"
            ? uploadRow.extracted_text
            : null,
      detectedLanguage:
        typeof attachmentRow.detected_language === "string"
          ? attachmentRow.detected_language
          : null,
    });
  } catch (error) {
    console.error("Get social attachment preview error:", error);
    return NextResponse.json(
      { error: "Failed to load attachment preview" },
      { status: 500 }
    );
  }
}
