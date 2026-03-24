import {
  ContentProviderTrack,
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

export function mapTimelineRow(timeline: KaraokeTimeline): KaraokeTimeline {
  return {
    ...timeline,
    cues: sanitizeLyricCues(timeline.cues),
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
