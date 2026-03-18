import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  findUserByExactEmail,
  getOrCreatePublicProfile,
  mapFriendship,
  mapPublicProfile,
  relationshipFromFriendship,
} from "@/lib/social/server";

export async function GET(request: NextRequest) {
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

    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const normalizedQuery = query.toLowerCase();
    const resultsMap = new Map<
      string,
      {
        id: string;
        username: string | null;
        display_name: string;
        avatar_seed: string | null;
        matched_by: "display_name" | "username" | "email";
      }
    >();

    const { data: partialMatches, error: partialError } = await supabase
      .from("public_profiles")
      .select("*")
      .neq("id", user.id)
      .not("username", "is", null)
      .or(
        `username.ilike.%${normalizedQuery}%,display_name.ilike.%${normalizedQuery}%`
      )
      .limit(12);

    if (partialError) {
      throw partialError;
    }

    for (const row of partialMatches ?? []) {
      const profile = mapPublicProfile(row);
      resultsMap.set(profile.id, {
        ...profile,
        matched_by:
          profile.username?.toLowerCase().includes(normalizedQuery)
            ? "username"
            : "display_name",
      });
    }

    if (normalizedQuery.includes("@")) {
      const matchedUser = await findUserByExactEmail(normalizedQuery);

      if (matchedUser && matchedUser.id !== user.id) {
        const { data: emailMatch, error: emailMatchError } = await supabase
          .from("public_profiles")
          .select("*")
          .eq("id", matchedUser.id)
          .not("username", "is", null)
          .maybeSingle();

        if (emailMatchError) {
          throw emailMatchError;
        }

        if (emailMatch) {
          const profile = mapPublicProfile(emailMatch);
          resultsMap.set(profile.id, {
            ...profile,
            matched_by: "email",
          });
        }
      }
    }

    const resultIds = Array.from(resultsMap.keys());
    if (resultIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const { data: friendships, error: friendshipsError } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

    if (friendshipsError) {
      throw friendshipsError;
    }

    const relationships = new Map(
      (friendships ?? []).map((row) => {
        const friendship = mapFriendship(row);
        const otherUserId =
          friendship.requester_id === user.id
            ? friendship.recipient_id
            : friendship.requester_id;
        return [otherUserId, friendship] as const;
      })
    );

    const results = resultIds.map((id) => {
      const profile = resultsMap.get(id)!;
      const friendship = relationships.get(id);

      return {
        ...profile,
        relationship: relationshipFromFriendship(friendship, user.id),
        friendship,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Social search error:", error);
    return NextResponse.json(
      { error: "Failed to search for learners" },
      { status: 500 }
    );
  }
}
