import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeKaraokeTrackUrl } from "@/lib/karaoke/providers";
import {
  createKaraokeItemFromTrack,
  loadKaraokeItemSummaries,
} from "@/lib/karaoke/item-server";
import {
  karaokeItemCreateSchema,
  validateRequestBody,
} from "@/lib/validations";

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

    const items = await loadKaraokeItemSummaries(supabase, user.id);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Karaoke items GET error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke items" },
      { status: 500 }
    );
  }
}

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
      karaokeItemCreateSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    const normalizedTrack = body.track
      ? {
          ...body.track,
          artworkUrl: body.track.artworkUrl ?? undefined,
          durationMs: body.track.durationMs ?? undefined,
        }
      : await normalizeKaraokeTrackUrl(body.url as string);

    if (normalizedTrack.provider === "tts") {
      return NextResponse.json(
        { error: "A music provider track is required" },
        { status: 400 }
      );
    }

    const item = await createKaraokeItemFromTrack(supabase, user.id, normalizedTrack);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create karaoke item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
