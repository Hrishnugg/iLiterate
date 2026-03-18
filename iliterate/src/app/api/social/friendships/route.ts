import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  getFriendIdFromFriendship,
  getOrCreatePublicProfile,
  getPublicProfilesByIds,
  mapFriendRequestSummary,
  mapFriendSummary,
  mapFriendship,
} from "@/lib/social/server";

const createFriendRequestSchema = z.object({
  recipientId: z.string().uuid(),
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

    const { data: friendshipRows, error: friendshipsError } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (friendshipsError) {
      throw friendshipsError;
    }

    const friendships = (friendshipRows ?? []).map((row) => mapFriendship(row));
    const otherUserIds = friendships.map((friendship) =>
      getFriendIdFromFriendship(friendship, user.id)
    );
    const publicProfiles = await getPublicProfilesByIds(supabase, otherUserIds);

    const incomingRequests = friendships
      .filter(
        (friendship) =>
          friendship.status === "pending" && friendship.recipient_id === user.id
      )
      .flatMap((friendship) => {
        const profile = publicProfiles.get(
          getFriendIdFromFriendship(friendship, user.id)
        );
        return profile
          ? [mapFriendRequestSummary(friendship, profile, user.id)]
          : [];
      });

    const outgoingRequests = friendships
      .filter(
        (friendship) =>
          friendship.status === "pending" && friendship.requester_id === user.id
      )
      .flatMap((friendship) => {
        const profile = publicProfiles.get(
          getFriendIdFromFriendship(friendship, user.id)
        );
        return profile
          ? [mapFriendRequestSummary(friendship, profile, user.id)]
          : [];
      });

    const friends = friendships
      .filter((friendship) => friendship.status === "accepted")
      .flatMap((friendship) => {
        const profile = publicProfiles.get(
          getFriendIdFromFriendship(friendship, user.id)
        );

        return profile ? [mapFriendSummary(friendship, profile, 0)] : [];
      });

    return NextResponse.json({
      incomingRequests: incomingRequests.map((item) => ({
        ...item.friendship,
        person: item.profile,
      })),
      outgoingRequests: outgoingRequests.map((item) => ({
        ...item.friendship,
        person: item.profile,
      })),
      friends: friends.map((item) => ({
        ...item.friendship,
        person: item.profile,
        unread_count: item.unread_count,
      })),
    });
  } catch (error) {
    console.error("Get social friendships error:", error);
    return NextResponse.json(
      { error: "Failed to load your social graph" },
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
    const parsed = createFriendRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid recipient" },
        { status: 400 }
      );
    }

    if (parsed.data.recipientId === user.id) {
      return NextResponse.json(
        { error: "You cannot add yourself as a friend" },
        { status: 400 }
      );
    }

    const { data: recipientProfile, error: recipientError } = await supabase
      .from("public_profiles")
      .select("*")
      .eq("id", parsed.data.recipientId)
      .not("username", "is", null)
      .maybeSingle();

    if (recipientError) {
      throw recipientError;
    }

    if (!recipientProfile) {
      return NextResponse.json(
        { error: "That learner is not available for social connections yet" },
        { status: 404 }
      );
    }

    const [userOneId, userTwoId] =
      user.id < parsed.data.recipientId
        ? [user.id, parsed.data.recipientId]
        : [parsed.data.recipientId, user.id];

    const { data: existingRow, error: existingError } = await supabase
      .from("friendships")
      .select("*")
      .eq("user_one_id", userOneId)
      .eq("user_two_id", userTwoId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingRow) {
      const existing = mapFriendship(existingRow);

      if (existing.status === "accepted") {
        return NextResponse.json(
          { error: "You are already friends" },
          { status: 409 }
        );
      }

      if (existing.status === "pending") {
        return NextResponse.json(
          {
            error:
              existing.requester_id === user.id
                ? "You already sent that request"
                : "That learner has already sent you a request",
          },
          { status: 409 }
        );
      }

      const { data: revived, error: reviveError } = await supabase
        .from("friendships")
        .update({
          requester_id: user.id,
          recipient_id: parsed.data.recipientId,
          status: "pending",
          responded_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (reviveError) {
        throw reviveError;
      }

      return NextResponse.json({
        friendship: {
          ...mapFriendship(revived),
          person: recipientProfile,
        },
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("friendships")
      .insert({
        user_one_id: userOneId,
        user_two_id: userTwoId,
        requester_id: user.id,
        recipient_id: parsed.data.recipientId,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      friendship: {
        ...mapFriendship(inserted),
        person: recipientProfile,
      },
    });
  } catch (error) {
    console.error("Create social friendship error:", error);
    return NextResponse.json(
      { error: "Failed to send the friend request" },
      { status: 500 }
    );
  }
}
