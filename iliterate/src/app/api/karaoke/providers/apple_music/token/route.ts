import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

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

    if (!env.karaoke.appleMusic.developerToken) {
      return NextResponse.json(
        { error: "Apple Music is not configured" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      developerToken: env.karaoke.appleMusic.developerToken,
      storefront: env.karaoke.appleMusic.storefront ?? "us",
    });
  } catch (error) {
    console.error("Apple Music token error:", error);
    return NextResponse.json(
      { error: "Failed to load Apple Music token" },
      { status: 500 }
    );
  }
}
