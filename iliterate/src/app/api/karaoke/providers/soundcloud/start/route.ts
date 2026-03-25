import { createHash, randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

function createCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

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

    if (!env.karaoke.soundcloud.clientId || !env.karaoke.soundcloud.clientSecret) {
      return NextResponse.json(
        { error: "SoundCloud is not configured" },
        { status: 503 }
      );
    }

    const returnTo = request.nextUrl.searchParams.get("returnTo") || "/karaoke";
    const state = randomUUID();
    const codeVerifier = createCodeVerifier();
    const redirectUri = new URL(
      "/api/karaoke/providers/soundcloud/callback",
      env.appUrl ?? request.nextUrl.origin
    );
    const authUrl = new URL("https://secure.soundcloud.com/authorize");
    authUrl.searchParams.set("client_id", env.karaoke.soundcloud.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri.toString());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("code_challenge", createCodeChallenge(codeVerifier));
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);

    const secureCookie = (env.appUrl ?? request.nextUrl.origin).startsWith("https://");
    const response = NextResponse.json({ authorizeUrl: authUrl.toString() });
    response.cookies.set("karaoke_soundcloud_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 60 * 10,
    });
    response.cookies.set("karaoke_soundcloud_return_to", returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 60 * 10,
    });
    response.cookies.set("karaoke_soundcloud_code_verifier", codeVerifier, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    console.error("SoundCloud start error:", error);
    return NextResponse.json(
      { error: "Failed to start SoundCloud authorization" },
      { status: 500 }
    );
  }
}
