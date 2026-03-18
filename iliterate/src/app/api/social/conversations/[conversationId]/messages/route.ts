import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  getPublicProfilesByIds,
  getUnreadCountForConversation,
  mapDirectConversation,
  mapDirectMessage,
} from "@/lib/social/server";

const createMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
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

    const { data: messageRows, error: messagesError } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (messagesError) {
      throw messagesError;
    }

    return NextResponse.json({
      conversation: {
        ...conversation,
        friend,
        unread_count: unreadCount,
      },
      messages: (messageRows ?? []).map((row) => mapDirectMessage(row)).reverse(),
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

    const { data: inserted, error: insertError } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: parsed.data.body,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      conversation: mapDirectConversation(conversationRow),
      message: mapDirectMessage(inserted),
    });
  } catch (error) {
    console.error("Create social message error:", error);
    return NextResponse.json(
      { error: "Failed to send the message" },
      { status: 500 }
    );
  }
}
