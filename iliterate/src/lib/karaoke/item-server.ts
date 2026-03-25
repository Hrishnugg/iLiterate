import { createClient } from "@/lib/supabase/server";
import {
  KaraokeItem,
  KaraokeItemDetail,
  KaraokeItemSummary,
  KaraokeItemTimeline,
  KaraokeItemTrack,
  KaraokeLyrics,
  KaraokeLyricsJob,
  KaraokeMusicProvider,
  KaraokeSetlist,
  KaraokeSetlistItemRow,
  KaraokeSetlistRow,
  KaraokeTrackLink,
  ProviderPlaylistSummary,
} from "@/types/database";
import {
  buildKaraokeItemDetail,
  buildKaraokeItemSummary,
  buildKaraokeSetlist,
  buildKaraokeSetlistItem,
} from "@/lib/karaoke/server";
import { toKaraokeError } from "@/lib/karaoke/errors";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type KaraokeBundle = {
  item: KaraokeItem;
  track: KaraokeItemTrack | null;
  lyrics: KaraokeLyrics | null;
  timeline: KaraokeItemTimeline | null;
  job: KaraokeLyricsJob | null;
};

type KaraokeItemRows = {
  items: KaraokeItem[];
  tracks: KaraokeItemTrack[];
  lyricsRows: KaraokeLyrics[];
  timelines: KaraokeItemTimeline[];
  jobs: KaraokeLyricsJob[];
};

async function loadItemRows(
  supabase: SupabaseClient,
  userId: string,
  itemIds?: string[]
): Promise<KaraokeItemRows> {
  const baseQuery = supabase
    .from("karaoke_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const itemsQuery =
    itemIds && itemIds.length > 0 ? baseQuery.in("id", itemIds) : baseQuery;

  const { data: items, error } = await itemsQuery;

  if (error) {
    throw toKaraokeError(error);
  }

  const typedItems = (items ?? []) as KaraokeItem[];
  if (typedItems.length === 0) {
    return {
      items: [],
      tracks: [],
      lyricsRows: [],
      timelines: [],
      jobs: [],
    };
  }

  const ids = typedItems.map((item) => item.id);
  const [tracksResult, lyricsResult, timelinesResult, jobsResult] = await Promise.all([
    supabase
      .from("karaoke_item_tracks")
      .select("*")
      .eq("user_id", userId)
      .in("karaoke_item_id", ids),
    supabase
      .from("karaoke_lyrics")
      .select("*")
      .eq("user_id", userId)
      .in("karaoke_item_id", ids),
    supabase
      .from("karaoke_item_timelines")
      .select("*")
      .eq("user_id", userId)
      .in("karaoke_item_id", ids),
    supabase
      .from("karaoke_lyrics_jobs")
      .select("*")
      .eq("user_id", userId)
      .in("karaoke_item_id", ids),
  ]);

  if (tracksResult.error) throw toKaraokeError(tracksResult.error);
  if (lyricsResult.error) throw toKaraokeError(lyricsResult.error);
  if (timelinesResult.error) throw toKaraokeError(timelinesResult.error);
  if (jobsResult.error) throw toKaraokeError(jobsResult.error);

  return {
    items: typedItems,
    tracks: (tracksResult.data ?? []) as KaraokeItemTrack[],
    lyricsRows: (lyricsResult.data ?? []) as KaraokeLyrics[],
    timelines: (timelinesResult.data ?? []) as KaraokeItemTimeline[],
    jobs: (jobsResult.data ?? []) as KaraokeLyricsJob[],
  };
}

function buildSummaryMapFromRows(rows: KaraokeItemRows) {
  const map = new Map<string, KaraokeItemSummary>();

  for (const item of rows.items) {
    const track =
      rows.tracks.find(
        (candidate) =>
          candidate.karaoke_item_id === item.id &&
          candidate.provider === item.primary_provider
      ) ?? null;
    const lyrics =
      rows.lyricsRows.find((candidate) => candidate.karaoke_item_id === item.id) ??
      null;
    const timeline =
      rows.timelines.find(
        (candidate) =>
          candidate.karaoke_item_id === item.id &&
          candidate.provider === item.primary_provider
      ) ?? null;
    const job =
      rows.jobs.find((candidate) => candidate.karaoke_item_id === item.id) ?? null;

    map.set(
      item.id,
      buildKaraokeItemSummary({
        item,
        track,
        lyrics,
        timeline,
        job,
      })
    );
  }

  return map;
}

export async function loadKaraokeItemSummaryMap(
  supabase: SupabaseClient,
  userId: string,
  itemIds?: string[]
) {
  const rows = await loadItemRows(supabase, userId, itemIds);
  return buildSummaryMapFromRows(rows);
}

export async function loadKaraokeItemSummaries(
  supabase: SupabaseClient,
  userId: string
): Promise<KaraokeItemSummary[]> {
  const summaryMap = await loadKaraokeItemSummaryMap(supabase, userId);
  return Array.from(summaryMap.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

async function loadSetlistRows(
  supabase: SupabaseClient,
  userId: string,
  setlistIds?: string[]
) {
  const baseQuery = supabase
    .from("karaoke_setlists")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  const query =
    setlistIds && setlistIds.length > 0 ? baseQuery.in("id", setlistIds) : baseQuery;
  const { data, error } = await query;

  if (error) {
    throw toKaraokeError(error);
  }

  return (data ?? []) as KaraokeSetlistRow[];
}

export async function ensureDefaultSetlist(
  supabase: SupabaseClient,
  userId: string
): Promise<KaraokeSetlistRow> {
  const { data, error } = await supabase
    .from("karaoke_setlists")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    throw toKaraokeError(error);
  }

  if (data) {
    return data as KaraokeSetlistRow;
  }

  const { data: created, error: createError } = await supabase
    .from("karaoke_setlists")
    .insert({
      user_id: userId,
      name: "Main Setlist",
      is_default: true,
      metadata: {},
    })
    .select("*")
    .single();

  if (createError) {
    throw toKaraokeError(createError);
  }

  return created as KaraokeSetlistRow;
}

export async function loadKaraokeSetlists(
  supabase: SupabaseClient,
  userId: string
): Promise<KaraokeSetlist[]> {
  await ensureDefaultSetlist(supabase, userId);
  const setlists = await loadSetlistRows(supabase, userId);

  if (setlists.length === 0) {
    return [];
  }

  const setlistIds = setlists.map((setlist) => setlist.id);
  const { data: setlistItemsData, error: setlistItemsError } = await supabase
    .from("karaoke_setlist_items")
    .select("*")
    .eq("user_id", userId)
    .in("setlist_id", setlistIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (setlistItemsError) {
    throw toKaraokeError(setlistItemsError);
  }

  const setlistItems = (setlistItemsData ?? []) as KaraokeSetlistItemRow[];
  const uniqueItemIds = Array.from(
    new Set(setlistItems.map((item) => item.karaoke_item_id))
  );
  const summaryMap = await loadKaraokeItemSummaryMap(supabase, userId, uniqueItemIds);

  return setlists.map((setlist) => {
    const items = setlistItems
      .filter((item) => item.setlist_id === setlist.id)
      .map((row) =>
        buildKaraokeSetlistItem({
          row,
          item: summaryMap.get(row.karaoke_item_id) ?? null,
        })
      );

    return buildKaraokeSetlist({
      setlist,
      items,
    });
  });
}

export async function loadKaraokeSetlist(
  supabase: SupabaseClient,
  userId: string,
  setlistId: string
): Promise<KaraokeSetlist | null> {
  const setlists = await loadKaraokeSetlists(supabase, userId);
  return setlists.find((setlist) => setlist.id === setlistId) ?? null;
}

export async function createKaraokeSetlist(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<KaraokeSetlist> {
  const trimmedName = name.trim();
  const { data, error } = await supabase
    .from("karaoke_setlists")
    .insert({
      user_id: userId,
      name: trimmedName,
      is_default: false,
      metadata: {},
    })
    .select("*")
    .single();

  if (error) {
    throw toKaraokeError(error);
  }

  return buildKaraokeSetlist({
    setlist: data as KaraokeSetlistRow,
    items: [],
  });
}

export async function updateKaraokeSetlist(
  supabase: SupabaseClient,
  userId: string,
  setlistId: string,
  updates: { name?: string }
) {
  const payload: Record<string, unknown> = {};
  if (typeof updates.name === "string" && updates.name.trim()) {
    payload.name = updates.name.trim();
  }

  const { error } = await supabase
    .from("karaoke_setlists")
    .update(payload)
    .eq("user_id", userId)
    .eq("id", setlistId);

  if (error) {
    throw toKaraokeError(error);
  }

  return loadKaraokeSetlist(supabase, userId, setlistId);
}

export async function deleteKaraokeSetlist(
  supabase: SupabaseClient,
  userId: string,
  setlistId: string
) {
  const { data, error: loadError } = await supabase
    .from("karaoke_setlists")
    .select("id, is_default")
    .eq("user_id", userId)
    .eq("id", setlistId)
    .maybeSingle();

  if (loadError) {
    throw toKaraokeError(loadError);
  }

  if (!data) {
    return;
  }

  if (data.is_default) {
    throw new Error("The default setlist cannot be deleted");
  }

  const { error } = await supabase
    .from("karaoke_setlists")
    .delete()
    .eq("user_id", userId)
    .eq("id", setlistId);

  if (error) {
    throw toKaraokeError(error);
  }
}

async function resolveSetlistRow(
  supabase: SupabaseClient,
  userId: string,
  setlistId?: string | null
) {
  if (!setlistId) {
    return ensureDefaultSetlist(supabase, userId);
  }

  const { data, error } = await supabase
    .from("karaoke_setlists")
    .select("*")
    .eq("user_id", userId)
    .eq("id", setlistId)
    .maybeSingle();

  if (error) {
    throw toKaraokeError(error);
  }

  if (!data) {
    throw new Error("Setlist not found");
  }

  return data as KaraokeSetlistRow;
}

export async function attachItemToSetlist(
  supabase: SupabaseClient,
  userId: string,
  karaokeItemId: string,
  setlistId?: string | null,
  metadata: Record<string, unknown> = {}
) {
  const setlist = await resolveSetlistRow(supabase, userId, setlistId);

  const { data: existing, error: existingError } = await supabase
    .from("karaoke_setlist_items")
    .select("*")
    .eq("user_id", userId)
    .eq("setlist_id", setlist.id)
    .eq("karaoke_item_id", karaokeItemId)
    .maybeSingle();

  if (existingError) {
    throw toKaraokeError(existingError);
  }

  if (existing) {
    return existing as KaraokeSetlistItemRow;
  }

  const { data: lastItem, error: lastItemError } = await supabase
    .from("karaoke_setlist_items")
    .select("sort_order")
    .eq("user_id", userId)
    .eq("setlist_id", setlist.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastItemError) {
    throw toKaraokeError(lastItemError);
  }

  const nextSortOrder =
    typeof lastItem?.sort_order === "number" ? lastItem.sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("karaoke_setlist_items")
    .insert({
      user_id: userId,
      setlist_id: setlist.id,
      karaoke_item_id: karaokeItemId,
      sort_order: nextSortOrder,
      metadata,
    })
    .select("*")
    .single();

  if (error) {
    throw toKaraokeError(error);
  }

  return data as KaraokeSetlistItemRow;
}

export async function removeKaraokeSetlistItem(
  supabase: SupabaseClient,
  userId: string,
  setlistId: string,
  setlistItemId: string
) {
  const { error } = await supabase
    .from("karaoke_setlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("setlist_id", setlistId)
    .eq("id", setlistItemId);

  if (error) {
    throw toKaraokeError(error);
  }
}

export async function reorderKaraokeSetlistItems(
  supabase: SupabaseClient,
  userId: string,
  setlistId: string,
  itemIds: string[]
) {
  const updates = itemIds.map((itemId, index) =>
    supabase
      .from("karaoke_setlist_items")
      .update({ sort_order: index })
      .eq("user_id", userId)
      .eq("setlist_id", setlistId)
      .eq("id", itemId)
  );

  const results = await Promise.all(updates);
  const firstError = results.find((result) => result.error)?.error;

  if (firstError) {
    throw toKaraokeError(firstError);
  }
}

export async function loadKaraokeItemBundle(
  supabase: SupabaseClient,
  userId: string,
  itemId: string
): Promise<KaraokeBundle | null> {
  const { data: itemData, error: itemError } = await supabase
    .from("karaoke_items")
    .select("*")
    .eq("user_id", userId)
    .eq("id", itemId)
    .maybeSingle();

  if (itemError) {
    throw toKaraokeError(itemError);
  }

  if (!itemData) {
    return null;
  }

  const item = itemData as KaraokeItem;

  const [trackResult, lyricsResult, timelineResult, jobResult] = await Promise.all([
    supabase
      .from("karaoke_item_tracks")
      .select("*")
      .eq("user_id", userId)
      .eq("karaoke_item_id", itemId)
      .eq("provider", item.primary_provider)
      .maybeSingle(),
    supabase
      .from("karaoke_lyrics")
      .select("*")
      .eq("user_id", userId)
      .eq("karaoke_item_id", itemId)
      .maybeSingle(),
    supabase
      .from("karaoke_item_timelines")
      .select("*")
      .eq("user_id", userId)
      .eq("karaoke_item_id", itemId)
      .eq("provider", item.primary_provider)
      .maybeSingle(),
    supabase
      .from("karaoke_lyrics_jobs")
      .select("*")
      .eq("user_id", userId)
      .eq("karaoke_item_id", itemId)
      .maybeSingle(),
  ]);

  if (trackResult.error) throw toKaraokeError(trackResult.error);
  if (lyricsResult.error) throw toKaraokeError(lyricsResult.error);
  if (timelineResult.error) throw toKaraokeError(timelineResult.error);
  if (jobResult.error) throw toKaraokeError(jobResult.error);

  return {
    item,
    track: (trackResult.data as KaraokeItemTrack | null) ?? null,
    lyrics: (lyricsResult.data as KaraokeLyrics | null) ?? null,
    timeline: (timelineResult.data as KaraokeItemTimeline | null) ?? null,
    job: (jobResult.data as KaraokeLyricsJob | null) ?? null,
  };
}

export async function loadKaraokeItemDetail(
  supabase: SupabaseClient,
  userId: string,
  itemId: string
): Promise<KaraokeItemDetail | null> {
  const bundle = await loadKaraokeItemBundle(supabase, userId, itemId);
  if (!bundle) {
    return null;
  }

  return buildKaraokeItemDetail(bundle);
}

function getLegacyStatusFromTrack(provider: KaraokeMusicProvider) {
  return provider === "spotify" ? "ready" : "fetching_lyrics";
}

function getTimingStatusFromTrack(provider: KaraokeMusicProvider) {
  return provider === "spotify" ? "not_applicable" : "draft";
}

export async function createKaraokeItemFromTrack(
  supabase: SupabaseClient,
  userId: string,
  track: KaraokeTrackLink,
  options?: {
    setlistId?: string | null;
    playlist?: ProviderPlaylistSummary | null;
  }
) {
  if (track.provider === "tts") {
    throw new Error("A music provider track is required");
  }

  const { data: existingTrack, error: existingTrackError } = await supabase
    .from("karaoke_item_tracks")
    .select("karaoke_item_id")
    .eq("user_id", userId)
    .eq("provider", track.provider)
    .eq("provider_track_id", track.providerTrackId)
    .maybeSingle();

  if (existingTrackError) {
    throw toKaraokeError(existingTrackError);
  }

  if (existingTrack?.karaoke_item_id) {
    await attachItemToSetlist(
      supabase,
      userId,
      existingTrack.karaoke_item_id,
      options?.setlistId,
      options?.playlist
        ? {
            sourcePlaylistId: options.playlist.playlistId,
            sourcePlaylistTitle: options.playlist.title,
            sourceProvider: options.playlist.provider,
          }
        : {}
    );
    return loadKaraokeItemDetail(supabase, userId, existingTrack.karaoke_item_id);
  }

  const legacyStatus = getLegacyStatusFromTrack(track.provider);
  const lyricsStatus = track.provider === "spotify" ? "manual_fallback" : "queued";
  const timingStatus = getTimingStatusFromTrack(track.provider);
  const providerSyncCapable = track.provider !== "spotify";

  const { data: itemData, error: itemError } = await supabase
    .from("karaoke_items")
    .insert({
      user_id: userId,
      title: track.title,
      artist: track.artist,
      status: legacyStatus,
      lyrics_status: lyricsStatus,
      timing_status: timingStatus,
      primary_provider: track.provider,
      primary_track_id: track.providerTrackId,
      primary_track_url: track.url,
      artwork_url: track.artworkUrl ?? null,
      duration_ms: track.durationMs ?? null,
      provider_sync_capable: providerSyncCapable,
      last_match_confidence: null,
      last_match_source: "queued",
      last_match_metadata: {},
      metadata: {
        karaokeCapable: track.karaokeCapable,
        playbackMode: track.playbackMode,
      },
    })
    .select("*")
    .single();

  if (itemError) {
    throw toKaraokeError(itemError);
  }

  const item = itemData as KaraokeItem;

  const [trackResult, lyricsResult, jobResult] = await Promise.all([
    supabase.from("karaoke_item_tracks").insert({
      user_id: userId,
      karaoke_item_id: item.id,
      provider: track.provider,
      provider_track_id: track.providerTrackId,
      url: track.url,
      title: track.title,
      artist: track.artist,
      artwork_url: track.artworkUrl ?? null,
      duration_ms: track.durationMs ?? null,
      karaoke_capable: track.karaokeCapable,
      playback_mode: track.playbackMode,
      metadata: {},
    }),
    supabase.from("karaoke_lyrics").insert({
      user_id: userId,
      karaoke_item_id: item.id,
      source: null,
      text: "",
      lines: [],
      metadata: {},
    }),
    supabase.from("karaoke_lyrics_jobs").upsert(
      {
        user_id: userId,
        karaoke_item_id: item.id,
        provider: track.provider,
        status: track.provider === "spotify" ? "completed" : "pending",
        attempts: 0,
        last_error: null,
        processed_at: track.provider === "spotify" ? new Date().toISOString() : null,
        metadata: {
          providerTrackId: track.providerTrackId,
          url: track.url,
          title: track.title,
          artist: track.artist,
          outcome: track.provider === "spotify" ? "spotify_metadata_only" : "queued",
        },
      },
      {
        onConflict: "karaoke_item_id",
      }
    ),
  ]);

  if (trackResult.error) throw toKaraokeError(trackResult.error);
  if (lyricsResult.error) throw toKaraokeError(lyricsResult.error);
  if (jobResult.error) throw toKaraokeError(jobResult.error);

  await attachItemToSetlist(
    supabase,
    userId,
    item.id,
    options?.setlistId,
    options?.playlist
      ? {
          sourcePlaylistId: options.playlist.playlistId,
          sourcePlaylistTitle: options.playlist.title,
          sourceProvider: options.playlist.provider,
        }
      : {}
  );

  return loadKaraokeItemDetail(supabase, userId, item.id);
}

export async function addTracksToSetlist(
  supabase: SupabaseClient,
  userId: string,
  setlistId: string | null | undefined,
  tracks: KaraokeTrackLink[],
  playlist?: ProviderPlaylistSummary | null
) {
  const results: KaraokeItemDetail[] = [];

  for (const track of tracks) {
    const item = await createKaraokeItemFromTrack(supabase, userId, track, {
      setlistId,
      playlist,
    });
    if (item) {
      results.push(item);
    }
  }

  return results;
}
