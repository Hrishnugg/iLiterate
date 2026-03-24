import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeKaraokeTrackUrl } from "@/lib/karaoke/providers";
import { mapTrackRowToLink } from "@/lib/karaoke/server";
import {
  karaokeProviderSchema,
  karaokeTrackLinkRequestSchema,
  uuidSchema,
  validateRequestBody,
} from "@/lib/validations";

async function ensureContentAccess(
  userId: string,
  contentId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase
    .from("content")
    .select("id")
    .eq("id", contentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id && userId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const contentIdResult = uuidSchema.safeParse(contentId);
    if (!contentIdResult.success) {
      return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await ensureContentAccess(user.id, contentId, supabase);
    if (!hasAccess) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("content_provider_tracks")
      .select("*")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load linked karaoke tracks" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tracks: ((data ?? []) as Array<{
        id: string;
        user_id: string;
        content_id: string;
        provider: "soundcloud" | "apple_music" | "spotify";
        provider_track_id: string;
        url: string;
        title: string;
        artist: string;
        artwork_url: string | null;
        duration_ms: number | null;
        karaoke_capable: boolean;
        playback_mode: "embedded" | "link_out";
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>).map(mapTrackRowToLink),
    });
  } catch (error) {
    console.error("Karaoke content GET error:", error);
    return NextResponse.json(
      { error: "Failed to load linked karaoke tracks" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const contentIdResult = uuidSchema.safeParse(contentId);
    if (!contentIdResult.success) {
      return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await ensureContentAccess(user.id, contentId, supabase);
    if (!hasAccess) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const { data: body, error: validationError } = await validateRequestBody(
      request,
      karaokeTrackLinkRequestSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    const normalized = await normalizeKaraokeTrackUrl(body.url);
    if (normalized.provider === "tts") {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("content_provider_tracks")
      .upsert(
        {
          user_id: user.id,
          content_id: contentId,
          provider: normalized.provider,
          provider_track_id: normalized.providerTrackId,
          url: normalized.url,
          title: normalized.title,
          artist: normalized.artist,
          artwork_url: normalized.artworkUrl ?? null,
          duration_ms: normalized.durationMs ?? null,
          karaoke_capable: normalized.karaokeCapable,
          playback_mode: normalized.playbackMode,
          metadata: {},
        },
        {
          onConflict: "user_id,content_id,provider",
        }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to link karaoke track" },
        { status: 500 }
      );
    }

    return NextResponse.json({ track: mapTrackRowToLink(data as never) }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to link karaoke track";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const contentIdResult = uuidSchema.safeParse(contentId);
    if (!contentIdResult.success) {
      return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
    }

    const provider = new URL(request.url).searchParams.get("provider");
    const providerResult = karaokeProviderSchema.safeParse(provider);
    if (!providerResult.success || providerResult.data === "tts") {
      return NextResponse.json({ error: "A provider is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("content_provider_tracks")
      .delete()
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .eq("provider", providerResult.data);

    if (error) {
      return NextResponse.json(
        { error: "Failed to remove linked karaoke track" },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Karaoke content DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove linked karaoke track" },
      { status: 500 }
    );
  }
}
