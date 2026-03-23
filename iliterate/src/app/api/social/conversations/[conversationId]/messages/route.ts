import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  getPublicProfilesByIds,
  getUnreadCountForConversation,
  listConversationMessages,
  mapDirectConversation,
} from "@/lib/social/server";

const attachmentSchema = z.object({
  uploadId: z.string().uuid(),
  attachmentType: z.enum(["image", "pdf", "docx"]),
  fileName: z.string().trim().max(255).nullable().optional(),
  mimeType: z.string().trim().max(255).nullable().optional(),
  extractedText: z.string().trim().max(10000).nullable().optional(),
  detectedLanguage: z.string().trim().max(32).nullable().optional(),
});

const createMessageSchema = z.object({
  body: z.string().trim().max(2000).optional().default(""),
  attachments: z.array(attachmentSchema).max(5).optional().default([]),
}).superRefine((value, ctx) => {
  if (!value.body.trim() && value.attachments.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["body"],
      message: "Message or attachment is required",
    });
  }
});

interface RouteContext {
  params: Promise<{
    conversationId: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { conversationId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: conversationRow, error: conversationError } = await supabase
      .from("direct_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (conversationError) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const conversation = mapDirectConversation(conversationRow);
    const friendId =
      conversation.user_one_id === user.id
        ? conversation.user_two_id
        : conversation.user_one_id;

    const profiles = await getPublicProfilesByIds(supabase, [friendId]);
    const friend = profiles.get(friendId) ?? null;

    const { data: readRow, error: readError } = await supabase
      .from("conversation_reads")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      throw readError;
    }

    const unreadCount = await getUnreadCountForConversation(
      supabase,
      conversationId,
      user.id,
      typeof readRow?.last_read_at === "string" ? readRow.last_read_at : null
    );

    return NextResponse.json({
      conversation: {
        ...conversation,
        friend,
        unread_count: unreadCount,
      },
      messages: await listConversationMessages(supabase, conversationId),
    });
  } catch (error) {
    console.error("Get social messages error:", error);
    return NextResponse.json(
      { error: "Failed to load conversation messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { conversationId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid message" },
        { status: 400 }
      );
    }

    const { data: conversationRow, error: conversationError } = await supabase
      .from("direct_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (conversationError) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const normalizedBody = parsed.data.body.trim();
    const attachmentIds = parsed.data.attachments.map((attachment) => attachment.uploadId);
    if (attachmentIds.length > 0) {
      const { data: uploads, error: uploadsError } = await supabase
        .from("user_uploads")
        .select("id")
        .eq("user_id", user.id)
        .in("id", attachmentIds);

      if (uploadsError) {
        throw uploadsError;
      }

      const ownedUploadIds = new Set((uploads ?? []).map((upload) => String(upload.id)));
      const missingUpload = attachmentIds.find((id) => !ownedUploadIds.has(id));
      if (missingUpload) {
        return NextResponse.json(
          { error: "Attachment not found or not owned by the sender" },
          { status: 403 }
        );
      }
    }

    const messageKind =
      parsed.data.attachments.length > 0
        ? normalizedBody
          ? "mixed"
          : "attachment"
        : "text";

    const { data: inserted, error: insertError } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: normalizedBody,
        message_kind: messageKind,
        primary_attachment_type:
          parsed.data.attachments[0]?.attachmentType ?? null,
        attachment_count: parsed.data.attachments.length,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    if (parsed.data.attachments.length > 0) {
      const { error: attachmentsError } = await supabase
        .from("direct_message_attachments")
        .insert(
          parsed.data.attachments.map((attachment) => ({
            message_id: inserted.id,
            upload_id: attachment.uploadId,
            attachment_type: attachment.attachmentType,
            file_name: attachment.fileName ?? null,
            mime_type: attachment.mimeType ?? null,
            extracted_text: attachment.extractedText ?? null,
            detected_language: attachment.detectedLanguage ?? null,
          }))
        );

      if (attachmentsError) {
        throw attachmentsError;
      }
    }

    const [hydratedMessage] = await listConversationMessages(
      supabase,
      conversationId,
      1
    );

    return NextResponse.json({
      conversation: mapDirectConversation(conversationRow),
      message: hydratedMessage ?? {
        ...inserted,
        attachments: [],
      },
    });
  } catch (error) {
    console.error("Create social message error:", error);
    return NextResponse.json(
      { error: "Failed to send the message" },
      { status: 500 }
    );
  }
}
