import {
  ContentProviderTrack,
  KaraokeItemLyricsStatus,
  KaraokeItem,
  KaraokeItemDetail,
  KaraokeItemSummary,
  KaraokeItemTimingStatus,
  KaraokeItemTimeline,
  KaraokeItemTrack,
  KaraokeLyrics,
  KaraokeLyricsJob,
  KaraokeLyricsLine,
  KaraokeSetlist,
  KaraokeSetlistItem,
  KaraokeSetlistItemRow,
  KaraokeSetlistRow,
  KaraokeTimeline,
  KaraokeTrackLink,
  LyricCue,
  MusicProviderConnection,
} from "@/types/database";
import { ProviderStatus, getBaseProviderStatuses } from "@/lib/karaoke/providers";

export function mapTrackRowToLink(track: ContentProviderTrack): KaraokeTrackLink {
  return {
    provider: track.provider,
    providerTrackId: track.provider_track_id,
    url: track.url,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artwork_url ?? undefined,
    durationMs: track.duration_ms ?? undefined,
    karaokeCapable: track.karaoke_capable,
    playbackMode: track.playback_mode,
  };
}

export function sanitizeLyricCues(cues: unknown): LyricCue[] {
  if (!Array.isArray(cues)) {
    return [];
  }

  return cues
    .map((cue) => {
      if (!cue || typeof cue !== "object") {
        return null;
      }

      const candidate = cue as Partial<LyricCue>;
      if (
        typeof candidate.startMs !== "number" ||
        typeof candidate.endMs !== "number" ||
        typeof candidate.startOffset !== "number" ||
        typeof candidate.endOffset !== "number" ||
        typeof candidate.text !== "string"
      ) {
        return null;
      }

      return {
        startMs: candidate.startMs,
        endMs: candidate.endMs,
        startOffset: candidate.startOffset,
        endOffset: candidate.endOffset,
        text: candidate.text,
      };
    })
    .filter((cue): cue is LyricCue => cue !== null);
}

export function sanitizeKaraokeLyricsLines(lines: unknown): KaraokeLyricsLine[] {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines
    .map((line) => {
      if (!line || typeof line !== "object") {
        return null;
      }

      const candidate = line as Partial<KaraokeLyricsLine>;
      if (typeof candidate.id !== "string" || typeof candidate.text !== "string") {
        return null;
      }

      return {
        id: candidate.id,
        text: candidate.text,
      };
    })
    .filter((line): line is KaraokeLyricsLine => line !== null);
}

export function mapTimelineRow(timeline: KaraokeTimeline): KaraokeTimeline {
  return {
    ...timeline,
    cues: sanitizeLyricCues(timeline.cues),
  };
}

export function mapKaraokeLyricsRow(lyrics: KaraokeLyrics): KaraokeLyrics {
  return {
    ...lyrics,
    lines: sanitizeKaraokeLyricsLines(lyrics.lines),
  };
}

export function mapKaraokeItemTimelineRow(
  timeline: KaraokeItemTimeline
): KaraokeItemTimeline {
  return {
    ...timeline,
    cues: sanitizeLyricCues(timeline.cues),
  };
}

export function mapKaraokeItemTrackRow(
  track: KaraokeItemTrack
): KaraokeTrackLink {
  return {
    provider: track.provider,
    providerTrackId: track.provider_track_id,
    url: track.url,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artwork_url ?? undefined,
    durationMs: track.duration_ms ?? undefined,
    karaokeCapable: track.karaoke_capable,
    playbackMode: track.playback_mode,
  };
}

function deriveLegacyLyricsStatus(
  item: KaraokeItem,
  lyrics: KaraokeLyrics | null,
  job: KaraokeLyricsJob | null
): KaraokeItemLyricsStatus {
  if (typeof item.lyrics_status === "string") {
    return item.lyrics_status;
  }

  if (item.status === "error") {
    return "error";
  }

  if (job?.status === "processing" || job?.status === "pending") {
    return "matching";
  }

  const lines = lyrics ? sanitizeKaraokeLyricsLines(lyrics.lines) : [];
  if (lines.length > 0) {
    return "ready";
  }

  if (item.status === "needs_lyrics") {
    return "manual_fallback";
  }

  return "queued";
}

function deriveLegacyTimingStatus(
  item: KaraokeItem,
  timeline: KaraokeItemTimeline | null
): KaraokeItemTimingStatus {
  if (typeof item.timing_status === "string") {
    return item.timing_status;
  }

  if (item.primary_provider === "spotify") {
    return "not_applicable";
  }

  const cues = timeline ? sanitizeLyricCues(timeline.cues) : [];
  return cues.length > 0 ? "ready" : "draft";
}

export function deriveKaraokeItemStatus(
  lyricsStatus: KaraokeItemLyricsStatus,
  timingStatus: KaraokeItemTimingStatus,
  providerSyncCapable: boolean
): KaraokeItemSummary["status"] {
  if (lyricsStatus === "error") {
    return "error";
  }

  if (lyricsStatus === "queued" || lyricsStatus === "matching") {
    return "matching";
  }

  if (lyricsStatus === "manual_fallback") {
    return "manual_fallback";
  }

  if (lyricsStatus === "needs_review") {
    return "needs_review";
  }

  if (providerSyncCapable && timingStatus !== "ready" && timingStatus !== "not_applicable") {
    return "needs_review";
  }

  if (timingStatus === "needs_review") {
    return "needs_review";
  }

  return "ready";
}

export function buildKaraokeItemSummary(args: {
  item: KaraokeItem;
  track: KaraokeItemTrack | null;
  lyrics: KaraokeLyrics | null;
  timeline: KaraokeItemTimeline | null;
  job: KaraokeLyricsJob | null;
}): KaraokeItemSummary {
  const { item, track, lyrics, timeline, job } = args;
  const sanitizedLyrics = lyrics ? sanitizeKaraokeLyricsLines(lyrics.lines) : [];
  const sanitizedCues = timeline ? sanitizeLyricCues(timeline.cues) : [];
  const providerSyncCapable =
    typeof item.provider_sync_capable === "boolean"
      ? item.provider_sync_capable
      : item.primary_provider !== "spotify";
  const lyricsStatus = deriveLegacyLyricsStatus(item, lyrics, job);
  const timingStatus = deriveLegacyTimingStatus(item, timeline);

  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    status: deriveKaraokeItemStatus(
      lyricsStatus,
      timingStatus,
      providerSyncCapable
    ),
    lyricsStatus,
    timingStatus,
    primaryProvider: item.primary_provider,
    artworkUrl: item.artwork_url ?? undefined,
    durationMs: item.duration_ms ?? undefined,
    providerSyncCapable,
    lineCount: sanitizedLyrics.length,
    hasLyrics: sanitizedLyrics.length > 0,
    hasTimeline: sanitizedCues.length > 0,
    track: track ? mapKaraokeItemTrackRow(track) : null,
    jobStatus: job?.status,
    matchConfidence:
      typeof item.last_match_confidence === "number"
        ? item.last_match_confidence
        : undefined,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export function buildKaraokeItemDetail(args: {
  item: KaraokeItem;
  track: KaraokeItemTrack | null;
  lyrics: KaraokeLyrics | null;
  timeline: KaraokeItemTimeline | null;
  job: KaraokeLyricsJob | null;
}): KaraokeItemDetail {
  const summary = buildKaraokeItemSummary(args);

  return {
    ...summary,
    metadata: args.item.metadata,
    lyrics: args.lyrics ? mapKaraokeLyricsRow(args.lyrics) : null,
    timeline: args.timeline ? mapKaraokeItemTimelineRow(args.timeline) : null,
    lastMatchSource: args.item.last_match_source ?? null,
    lastMatchMetadata: args.item.last_match_metadata ?? {},
  };
}

export function buildKaraokeSetlist(args: {
  setlist: KaraokeSetlistRow;
  items: KaraokeSetlistItem[];
}): KaraokeSetlist {
  const sortedItems = [...args.items].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: args.setlist.id,
    name: args.setlist.name,
    isDefault: args.setlist.is_default,
    metadata: args.setlist.metadata ?? {},
    itemCount: sortedItems.length,
    items: sortedItems,
    createdAt: args.setlist.created_at,
    updatedAt: args.setlist.updated_at,
  };
}

export function buildKaraokeSetlistItem(args: {
  row: KaraokeSetlistItemRow;
  item: KaraokeItemSummary | null;
}): KaraokeSetlistItem {
  return {
    id: args.row.id,
    karaokeItemId: args.row.karaoke_item_id,
    sortOrder: args.row.sort_order,
    metadata: args.row.metadata ?? {},
    item: args.item,
    createdAt: args.row.created_at,
    updatedAt: args.row.updated_at,
  };
}

export function buildProviderStatuses(
  connections: Pick<MusicProviderConnection, "id" | "provider" | "metadata" | "expires_at">[],
  config: {
    soundcloudConfigured: boolean;
    appleMusicConfigured: boolean;
    spotifyConfigured: boolean;
  }
): ProviderStatus[] {
  const baseStatuses = getBaseProviderStatuses(config);

  return baseStatuses.map((status) => {
    const connection = connections.find((candidate) => candidate.provider === status.provider);
    if (!connection) {
      return status;
    }

    const expiresAt = connection.expires_at ? Date.parse(connection.expires_at) : Number.NaN;
    const isExpired = Number.isFinite(expiresAt) ? expiresAt <= Date.now() : false;

    return {
      ...status,
      connected: !isExpired,
      connectionId: connection.id,
      metadata: {
        ...(connection.metadata ?? {}),
        expiresAt: connection.expires_at,
        expired: isExpired,
      },
    };
  });
}
