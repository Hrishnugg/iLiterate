import {
  ContentProviderTrack,
  KaraokeItem,
  KaraokeItemDetail,
  KaraokeItemSummary,
  KaraokeItemTimeline,
  KaraokeItemTrack,
  KaraokeLyrics,
  KaraokeLyricsJob,
  KaraokeLyricsLine,
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

export function buildKaraokeItemSummary(args: {
  item: KaraokeItem;
  track: KaraokeItemTrack | null;
  lyrics: KaraokeLyrics | null;
  timeline: KaraokeItemTimeline | null;
  job: KaraokeLyricsJob | null;
}): KaraokeItemSummary {
  const { item, track, lyrics, timeline, job } = args;

  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    status: item.status,
    primaryProvider: item.primary_provider,
    artworkUrl: item.artwork_url ?? undefined,
    durationMs: item.duration_ms ?? undefined,
    lineCount: lyrics ? sanitizeKaraokeLyricsLines(lyrics.lines).length : 0,
    hasLyrics: Boolean(lyrics && sanitizeKaraokeLyricsLines(lyrics.lines).length > 0),
    hasTimeline: Boolean(timeline && sanitizeLyricCues(timeline.cues).length > 0),
    track: track ? mapKaraokeItemTrackRow(track) : null,
    jobStatus: job?.status,
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
  };
}

export function buildProviderStatuses(
  connections: Pick<MusicProviderConnection, "id" | "provider" | "metadata" | "expires_at">[],
  config: {
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
