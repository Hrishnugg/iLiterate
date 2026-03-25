import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeKaraokeTrackUrl } from "@/lib/karaoke/providers";
import {
  addTracksToSetlist,
  attachItemToSetlist,
  loadKaraokeSetlist,
  removeKaraokeSetlistItem,
  reorderKaraokeSetlistItems,
} from "@/lib/karaoke/item-server";
import {
  karaokeSetlistItemCreateSchema,
  karaokeSetlistReorderSchema,
  uuidSchema,
  validateRequestBody,
} from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ setlistId: string }> }
) {
  try {
    const { setlistId } = await params;
    const parsed = uuidSchema.safeParse(setlistId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid setlist ID format" }, { status: 400 });
    }

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
      karaokeSetlistItemCreateSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    if (body.karaokeItemId) {
      await attachItemToSetlist(supabase, user.id, body.karaokeItemId, setlistId);
    } else {
      const urlTracks = await Promise.all(
        [...(body.url ? [body.url] : []), ...(body.urls ?? [])].map((url) =>
          normalizeKaraokeTrackUrl(url)
        )
      );
      const tracks = [
        ...(body.track ? [{ ...body.track, artworkUrl: body.track.artworkUrl ?? undefined, durationMs: body.track.durationMs ?? undefined }] : []),
        ...((body.tracks ?? []).map((track) => ({
          ...track,
          artworkUrl: track.artworkUrl ?? undefined,
          durationMs: track.durationMs ?? undefined,
        }))),
        ...urlTracks,
      ];

      await addTracksToSetlist(
        supabase,
        user.id,
        setlistId,
        tracks,
        body.playlist
          ? {
              provider: body.playlist.provider,
              playlistId: body.playlist.playlistId,
              title: body.playlist.title ?? "Playlist import",
              curator: body.playlist.provider,
              trackCount: tracks.length,
            }
          : null
      );
    }

    const setlist = await loadKaraokeSetlist(supabase, user.id, setlistId);
    return NextResponse.json({ setlist });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add karaoke setlist items";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ setlistId: string }> }
) {
  try {
    const { setlistId } = await params;
    const parsed = uuidSchema.safeParse(setlistId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid setlist ID format" }, { status: 400 });
    }

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
      karaokeSetlistReorderSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    await reorderKaraokeSetlistItems(supabase, user.id, setlistId, body.itemIds);
    const setlist = await loadKaraokeSetlist(supabase, user.id, setlistId);
    return NextResponse.json({ setlist });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reorder karaoke setlist";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ setlistId: string }> }
) {
  try {
    const { setlistId } = await params;
    const parsedSetlist = uuidSchema.safeParse(setlistId);
    const setlistItemId = request.nextUrl.searchParams.get("setlistItemId");
    const parsedItem = uuidSchema.safeParse(setlistItemId);
    if (!parsedSetlist.success || !parsedItem.success) {
      return NextResponse.json(
        { error: "Invalid setlist or setlist item ID format" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await removeKaraokeSetlistItem(supabase, user.id, setlistId, parsedItem.data);
    const setlist = await loadKaraokeSetlist(supabase, user.id, setlistId);
    return NextResponse.json({ setlist });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove karaoke setlist item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
