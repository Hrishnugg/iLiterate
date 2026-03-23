import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getSignedUploadUrl } from "@/lib/social/server";

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
      .select("id, upload_id, attachment_type, file_name, mime_type")
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
      .select("storage_path")
      .eq("id", attachmentRow.upload_id)
      .single();

    if (uploadError || !uploadRow) {
      return NextResponse.json(
        { error: "Attachment storage record is unavailable" },
        { status: 404 }
      );
    }

    const storagePath =
      typeof uploadRow.storage_path === "string" ? uploadRow.storage_path : null;

    if (!storagePath) {
      return NextResponse.json(
        { error: "Attachment storage path is unavailable" },
        { status: 409 }
      );
    }

    const signedUrl = await getSignedUploadUrl(storagePath);

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
          : null,
      url: signedUrl,
    });
  } catch (error) {
    console.error("Get social attachment URL error:", error);
    return NextResponse.json(
      { error: "Failed to load attachment" },
      { status: 500 }
    );
  }
}
