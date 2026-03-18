import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  defaultAvatarSeed,
  getOrCreatePublicProfile,
  mapPublicProfile,
} from "@/lib/social/server";

const updatePublicProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/),
  displayName: z.string().trim().min(1).max(50),
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

    const profile = await getOrCreatePublicProfile(supabase, user);
    return NextResponse.json({ profile, public_profile: profile });
  } catch (error) {
    console.error("Get social public profile error:", error);
    return NextResponse.json(
      { error: "Failed to load your social profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const parsed = updatePublicProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid profile data" },
        { status: 400 }
      );
    }

    const payload = {
      id: user.id,
      username: parsed.data.username,
      display_name: parsed.data.displayName,
      avatar_seed: defaultAvatarSeed(user.id),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("public_profiles")
      .upsert(payload)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That username is already taken" },
          { status: 409 }
        );
      }

      console.error("Upsert social public profile error:", error);
      return NextResponse.json(
        { error: "Failed to update your social profile" },
        { status: 500 }
      );
    }

    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          full_name: parsed.data.displayName,
        },
      });
    } catch (adminError) {
      console.error("Sync auth display name error:", adminError);
    }

    const profile = mapPublicProfile(data);
    return NextResponse.json({ profile, public_profile: profile });
  } catch (error) {
    console.error("Update social public profile error:", error);
    return NextResponse.json(
      { error: "Failed to update your social profile" },
      { status: 500 }
    );
  }
}
