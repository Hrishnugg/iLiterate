import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/karaoke/crypto";
import { appleMusicConnectSchema, validateRequestBody } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: body, error: validationError } = await validateRequestBody(
      request,
      appleMusicConnectSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_music_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "apple_music",
          access_token_encrypted: encryptSecret(body.musicUserToken),
          token_type: "music-user-token",
          metadata: {
            storefrontId: body.storefrontId ?? null,
          },
        },
        {
          onConflict: "user_id,provider",
        }
      )
      .select("id, provider, metadata, expires_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to connect Apple Music" },
        { status: 500 }
      );
    }

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error("Apple Music connect error:", error);
    return NextResponse.json(
      { error: "Failed to connect Apple Music" },
      { status: 500 }
    );
  }
}
