import { createClient } from "@/lib/supabase/server";
import {
  KaraokeItem,
  KaraokeItemDetail,
  KaraokeItemSummary,
  KaraokeItemTimeline,
  KaraokeItemTrack,
  KaraokeLyrics,
  KaraokeLyricsJob,
  KaraokeTrackLink,
} from "@/types/database";
import {
  buildKaraokeItemDetail,
  buildKaraokeItemSummary,
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

export async function loadKaraokeItemSummaries(
  supabase: SupabaseClient,
  userId: string
): Promise<KaraokeItemSummary[]> {
  const { data: items, error } = await supabase
    .from("karaoke_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw toKaraokeError(error);
  }

  const typedItems = (items ?? []) as KaraokeItem[];
  if (typedItems.length === 0) {
    return [];
  }

  const itemIds = typedItems.map((item) => item.id);
  const [tracksResult, lyricsResult, timelinesResult, jobsResult] = await Promise.all([
    supabase
      .from("karaoke_item_tracks")
      .select("*")
      .eq("user_id", userId)
      .in("karaoke_item_id", itemIds),
    supabase
      .from("karaoke_lyrics")
      .select("*")
      .eq("user_id", userId)
      .in("karaoke_item_id", itemIds),
    supabase
      .from("karaoke_item_timelines")
      .select("*")
      .eq("user_id", userId)
      .in("karaoke_item_id", itemIds),
    supabase
      .from("karaoke_lyrics_jobs")
      .select("*")
      .eq("user_id", userId)
      .in("karaoke_item_id", itemIds),
  ]);

  if (tracksResult.error) throw toKaraokeError(tracksResult.error);
  if (lyricsResult.error) throw toKaraokeError(lyricsResult.error);
  if (timelinesResult.error) throw toKaraokeError(timelinesResult.error);
  if (jobsResult.error) throw toKaraokeError(jobsResult.error);

  const tracks = (tracksResult.data ?? []) as KaraokeItemTrack[];
  const lyricsRows = (lyricsResult.data ?? []) as KaraokeLyrics[];
  const timelines = (timelinesResult.data ?? []) as KaraokeItemTimeline[];
  const jobs = (jobsResult.data ?? []) as KaraokeLyricsJob[];

  return typedItems.map((item) => {
    const track =
      tracks.find(
        (candidate) =>
          candidate.karaoke_item_id === item.id &&
          candidate.provider === item.primary_provider
      ) ?? null;
    const lyrics =
      lyricsRows.find((candidate) => candidate.karaoke_item_id === item.id) ?? null;
    const timeline =
      timelines.find(
        (candidate) =>
          candidate.karaoke_item_id === item.id &&
          candidate.provider === item.primary_provider
      ) ?? null;
    const job = jobs.find((candidate) => candidate.karaoke_item_id === item.id) ?? null;

    return buildKaraokeItemSummary({
      item,
      track,
      lyrics,
      timeline,
      job,
    });
  });
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

export async function createKaraokeItemFromTrack(
  supabase: SupabaseClient,
  userId: string,
  track: KaraokeTrackLink
) {
  if (track.provider === "tts") {
    throw new Error("A music provider track is required");
  }

  const { data: itemData, error: itemError } = await supabase
    .from("karaoke_items")
    .insert({
      user_id: userId,
      title: track.title,
      artist: track.artist,
      status: "fetching_lyrics",
      primary_provider: track.provider,
      primary_track_id: track.providerTrackId,
      primary_track_url: track.url,
      artwork_url: track.artworkUrl ?? null,
      duration_ms: track.durationMs ?? null,
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
        status: "pending",
        attempts: 0,
        last_error: null,
        metadata: {
          providerTrackId: track.providerTrackId,
          url: track.url,
          title: track.title,
          artist: track.artist,
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

  return loadKaraokeItemDetail(supabase, userId, item.id);
}
