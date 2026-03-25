import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/karaoke/crypto";
import { env } from "@/lib/env";

function cleanupCookies(response: NextResponse) {
  response.cookies.delete("karaoke_soundcloud_state");
  response.cookies.delete("karaoke_soundcloud_return_to");
  response.cookies.delete("karaoke_soundcloud_code_verifier");
}

export async function GET(request: NextRequest) {
  const returnTo =
    request.cookies.get("karaoke_soundcloud_return_to")?.value || "/karaoke";

  try {
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    const expectedState = request.cookies.get("karaoke_soundcloud_state")?.value;
    const codeVerifier =
      request.cookies.get("karaoke_soundcloud_code_verifier")?.value;

    if (!state || !code || !expectedState || !codeVerifier || state !== expectedState) {
      const response = NextResponse.redirect(
        new URL(`${returnTo}?karaoke_soundcloud=invalid_state`, request.nextUrl.origin)
      );
      cleanupCookies(response);
      return response;
    }

    if (!env.karaoke.soundcloud.clientId || !env.karaoke.soundcloud.clientSecret) {
      const response = NextResponse.redirect(
        new URL(`${returnTo}?karaoke_soundcloud=not_configured`, request.nextUrl.origin)
      );
      cleanupCookies(response);
      return response;
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const response = NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(returnTo)}`, request.nextUrl.origin)
      );
      cleanupCookies(response);
      return response;
    }

    const redirectUri = new URL(
      "/api/karaoke/providers/soundcloud/callback",
      env.appUrl ?? request.nextUrl.origin
    );

    const tokenResponse = await fetch("https://secure.soundcloud.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json; charset=utf-8",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.karaoke.soundcloud.clientId,
        client_secret: env.karaoke.soundcloud.clientSecret,
        redirect_uri: redirectUri.toString(),
        code,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const response = NextResponse.redirect(
        new URL(`${returnTo}?karaoke_soundcloud=token_error`, request.nextUrl.origin)
      );
      cleanupCookies(response);
      return response;
    }

    const payload = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
    };

    const meResponse = await fetch("https://api.soundcloud.com/me", {
      headers: {
        Authorization: `OAuth ${payload.access_token}`,
        Accept: "application/json; charset=utf-8",
      },
    });

    const mePayload = meResponse.ok
      ? ((await meResponse.json()) as {
          id?: number | string;
          permalink?: string;
          username?: string;
          avatar_url?: string;
        })
      : null;

    const expiresAt =
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;

    const { error: upsertError } = await supabase
      .from("user_music_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "soundcloud",
          access_token_encrypted: encryptSecret(payload.access_token),
          refresh_token_encrypted: payload.refresh_token
            ? encryptSecret(payload.refresh_token)
            : null,
          token_type: payload.token_type ?? "OAuth",
          expires_at: expiresAt,
          external_user_id: mePayload?.id ? String(mePayload.id) : null,
          scopes: payload.scope ? payload.scope.split(/\s+/).filter(Boolean) : [],
          metadata: {
            username: mePayload?.username ?? null,
            permalink: mePayload?.permalink ?? null,
            avatarUrl: mePayload?.avatar_url ?? null,
          },
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (upsertError) {
      const response = NextResponse.redirect(
        new URL(`${returnTo}?karaoke_soundcloud=save_error`, request.nextUrl.origin)
      );
      cleanupCookies(response);
      return response;
    }

    const response = NextResponse.redirect(
      new URL(`${returnTo}?karaoke_soundcloud=connected`, request.nextUrl.origin)
    );
    cleanupCookies(response);
    return response;
  } catch (error) {
    console.error("SoundCloud callback error:", error);
    const response = NextResponse.redirect(
      new URL(`${returnTo}?karaoke_soundcloud=error`, request.nextUrl.origin)
    );
    cleanupCookies(response);
    return response;
  }
}
