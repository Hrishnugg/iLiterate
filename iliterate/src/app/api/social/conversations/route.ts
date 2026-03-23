import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  getOrCreatePublicProfile,
  listConversationMessages,
  getPublicProfilesByIds,
  getUnreadCountForConversation,
  mapDirectConversation,
  mapFriendship,
  normalizeSocialPair,
} from "@/lib/social/server";

const createConversationSchema = z.object({
  friendId: z.string().uuid(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreatePublicProfile(supabase, user);

    const { data: conversationRows, error: conversationsError } = await supabase
      .from("direct_conversations")
      .select("*")
      .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (conversationsError) {
      throw conversationsError;
    }

    const conversations = (conversationRows ?? []).map((row) => mapDirectConversation(row));
    if (conversations.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    const friendIds = conversations.map((conversation) =>
      conversation.user_one_id === user.id
        ? conversation.user_two_id
        : conversation.user_one_id
    );
    const profiles = await getPublicProfilesByIds(supabase, friendIds);

    const { data: readRows, error: readsError } = await supabase
      .from("conversation_reads")
      .select("*")
      .eq("user_id", user.id)
      .in(
        "conversation_id",
        conversations.map((conversation) => conversation.id)
      );

    if (readsError) {
      throw readsError;
    }

    const readLookup = new Map<string, string | null>(
      (readRows ?? []).map((row) => [
        String(row.conversation_id),
        typeof row.last_read_at === "string" ? row.last_read_at : null,
      ])
    );

    const summaries = await Promise.all(
      conversations.map(async (conversation) => {
        const friendId =
          conversation.user_one_id === user.id
            ? conversation.user_two_id
            : conversation.user_one_id;
        const friend = profiles.get(friendId);
        const unreadCount = await getUnreadCountForConversation(
          supabase,
          conversation.id,
          user.id,
          readLookup.get(conversation.id) ?? null
        );

        return {
          ...conversation,
          friend: friend ?? null,
          unread_count: unreadCount,
        };
      })
    );

    return NextResponse.json({ conversations: summaries });
  } catch (error) {
    console.error("Get social conversations error:", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

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

    await getOrCreatePublicProfile(supabase, user);

    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid friend selection" },
        { status: 400 }
      );
    }

    if (parsed.data.friendId === user.id) {
      return NextResponse.json(
        { error: "You cannot open a conversation with yourself" },
        { status: 400 }
      );
    }

    const [userOneId, userTwoId] = normalizeSocialPair(user.id, parsed.data.friendId);

    const { data: friendshipRow, error: friendshipError } = await supabase
      .from("friendships")
      .select("*")
      .eq("user_one_id", userOneId)
      .eq("user_two_id", userTwoId)
      .eq("status", "accepted")
      .maybeSingle();

    if (friendshipError) {
      throw friendshipError;
    }

    if (!friendshipRow) {
      return NextResponse.json(
        { error: "You can only message accepted friends" },
        { status: 403 }
      );
    }

    const friendship = mapFriendship(friendshipRow);

    let { data: conversationRow, error: conversationError } = await supabase
      .from("direct_conversations")
      .select("*")
      .eq("user_one_id", friendship.user_one_id)
      .eq("user_two_id", friendship.user_two_id)
      .maybeSingle();

    if (conversationError) {
      throw conversationError;
    }

    if (!conversationRow) {
      const insertResult = await supabase
        .from("direct_conversations")
        .insert({
          user_one_id: friendship.user_one_id,
          user_two_id: friendship.user_two_id,
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      conversationRow = insertResult.data;
      conversationError = insertResult.error;
    }

    if (conversationError || !conversationRow) {
      throw conversationError ?? new Error("Failed to create conversation");
    }

    const conversation = mapDirectConversation(conversationRow);
    const profiles = await getPublicProfilesByIds(supabase, [parsed.data.friendId]);
    const friend = profiles.get(parsed.data.friendId) ?? null;

    const messages = await listConversationMessages(supabase, conversation.id);

    return NextResponse.json({
      conversation: {
        ...conversation,
        friend,
        unread_count: 0,
      },
      messages,
    });
  } catch (error) {
    console.error("Create social conversation error:", error);
    return NextResponse.json(
      { error: "Failed to open conversation" },
      { status: 500 }
    );
  }
}
