import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { mapFriendship } from "@/lib/social/server";

const updateFriendshipSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateFriendshipSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid friendship action" },
        { status: 400 }
      );
    }

    const { data: friendshipRow, error: friendshipError } = await supabase
      .from("friendships")
      .select("*")
      .eq("id", id)
      .single();

    if (friendshipError) {
      return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
    }

    const friendship = mapFriendship(friendshipRow);

    if (![friendship.requester_id, friendship.recipient_id].includes(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (parsed.data.action === "cancel") {
      if (friendship.requester_id !== user.id || friendship.status !== "pending") {
        return NextResponse.json(
          { error: "Only the sender can cancel a pending request" },
          { status: 403 }
        );
      }

      const { error: deleteError } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendship.id);

      if (deleteError) {
        throw deleteError;
      }

      return new NextResponse(null, { status: 204 });
    }

    if (friendship.recipient_id !== user.id || friendship.status !== "pending") {
      return NextResponse.json(
        { error: "Only the recipient can respond to a pending request" },
        { status: 403 }
      );
    }

    const nextStatus = parsed.data.action === "accept" ? "accepted" : "declined";
    const { data: updated, error: updateError } = await supabase
      .from("friendships")
      .update({
        status: nextStatus,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", friendship.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ friendship: mapFriendship(updated) });
  } catch (error) {
    console.error("Update social friendship error:", error);
    return NextResponse.json(
      { error: "Failed to update the friend request" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: friendshipRow, error: friendshipError } = await supabase
      .from("friendships")
      .select("*")
      .eq("id", id)
      .single();

    if (friendshipError) {
      return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
    }

    const friendship = mapFriendship(friendshipRow);

    if (![friendship.requester_id, friendship.recipient_id].includes(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: conversationDeleteError } = await supabase
      .from("direct_conversations")
      .delete()
      .eq("user_one_id", friendship.user_one_id)
      .eq("user_two_id", friendship.user_two_id);

    if (conversationDeleteError) {
      throw conversationDeleteError;
    }

    const { error: friendshipDeleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendship.id);

    if (friendshipDeleteError) {
      throw friendshipDeleteError;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete social friendship error:", error);
    return NextResponse.json(
      { error: "Failed to remove the friendship" },
      { status: 500 }
    );
  }
}
