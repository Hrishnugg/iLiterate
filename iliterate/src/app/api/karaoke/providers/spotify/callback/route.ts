import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/karaoke/crypto";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const returnTo =
    request.cookies.get("karaoke_spotify_return_to")?.value || "/home";

  try {
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    const error = request.nextUrl.searchParams.get("error");
    const expectedState = request.cookies.get("karaoke_spotify_state")?.value;

    if (error) {
      return NextResponse.redirect(
        new URL(`${returnTo}?karaoke_spotify=denied`, request.nextUrl.origin)
      );
    }

    if (!state || !code || !expectedState || state !== expectedState) {
      return NextResponse.redirect(
        new URL(`${returnTo}?karaoke_spotify=invalid_state`, request.nextUrl.origin)
      );
    }

    if (!env.karaoke.spotify.clientId || !env.karaoke.spotify.clientSecret) {
      return NextResponse.redirect(
        new URL(`${returnTo}?karaoke_spotify=not_configured`, request.nextUrl.origin)
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(returnTo)}`, request.nextUrl.origin)
      );
    }

    const redirectUri = new URL(
      "/api/karaoke/providers/spotify/callback",
      env.appUrl ?? request.nextUrl.origin
    );

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${env.karaoke.spotify.clientId}:${env.karaoke.spotify.clientSecret}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri.toString(),
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL(`${returnTo}?karaoke_spotify=token_error`, request.nextUrl.origin)
      );
    }

    const payload = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
    };

    const expiresAt =
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;

    const { error: upsertError } = await supabase
      .from("user_music_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "spotify",
          access_token_encrypted: encryptSecret(payload.access_token),
          refresh_token_encrypted: payload.refresh_token
            ? encryptSecret(payload.refresh_token)
            : null,
          token_type: payload.token_type ?? "Bearer",
          expires_at: expiresAt,
          scopes: payload.scope ? payload.scope.split(/\s+/).filter(Boolean) : [],
          metadata: {
            policyNotice:
              "Spotify-linked tracks are intentionally not synchronized to karaoke visuals.",
          },
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (upsertError) {
      return NextResponse.redirect(
        new URL(`${returnTo}?karaoke_spotify=save_error`, request.nextUrl.origin)
      );
    }

    const response = NextResponse.redirect(
      new URL(`${returnTo}?karaoke_spotify=connected`, request.nextUrl.origin)
    );
    response.cookies.delete("karaoke_spotify_state");
    response.cookies.delete("karaoke_spotify_return_to");
    return response;
  } catch (error) {
    console.error("Spotify callback error:", error);
    const response = NextResponse.redirect(
      new URL(`${returnTo}?karaoke_spotify=error`, request.nextUrl.origin)
    );
    response.cookies.delete("karaoke_spotify_state");
    response.cookies.delete("karaoke_spotify_return_to");
    return response;
  }
}
