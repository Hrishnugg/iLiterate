import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { buildProviderStatuses } from "@/lib/karaoke/server";

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

    const { data, error } = await supabase
      .from("user_music_connections")
      .select("id, provider, metadata, expires_at")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load karaoke providers" },
        { status: 500 }
      );
    }

    const providers = buildProviderStatuses(
      (data ?? []) as Array<{
        id: string;
        provider: "soundcloud" | "apple_music" | "spotify";
        metadata: Record<string, unknown>;
        expires_at: string | null;
      }>,
      {
        appleMusicConfigured: Boolean(env.karaoke.appleMusic.developerToken),
        spotifyConfigured: Boolean(
          env.karaoke.spotify.clientId && env.karaoke.spotify.clientSecret
        ),
      }
    );

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Karaoke providers GET error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke providers" },
      { status: 500 }
    );
  }
}
