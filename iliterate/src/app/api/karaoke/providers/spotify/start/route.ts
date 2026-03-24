import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const SPOTIFY_SCOPES = [
  "streaming",
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-read-email",
  "user-read-private",
].join(" ");

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

    if (!env.karaoke.spotify.clientId || !env.karaoke.spotify.clientSecret) {
      return NextResponse.json(
        { error: "Spotify is not configured" },
        { status: 503 }
      );
    }

    const returnTo = request.nextUrl.searchParams.get("returnTo") || "/home";
    const state = randomUUID();
    const redirectUri = new URL(
      "/api/karaoke/providers/spotify/callback",
      env.appUrl ?? request.nextUrl.origin
    );

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", env.karaoke.spotify.clientId);
    authUrl.searchParams.set("scope", SPOTIFY_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri.toString());
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("show_dialog", "true");

    const response = NextResponse.json({ authorizeUrl: authUrl.toString() });
    response.cookies.set("karaoke_spotify_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 10,
    });
    response.cookies.set("karaoke_spotify_return_to", returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    console.error("Spotify start error:", error);
    return NextResponse.json(
      { error: "Failed to start Spotify authorization" },
      { status: 500 }
    );
  }
}
