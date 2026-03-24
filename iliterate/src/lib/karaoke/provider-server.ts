import { Buffer } from "buffer";
import { env } from "@/lib/env";
import {
  KaraokeMusicProvider,
  KaraokeTrackLink,
} from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/karaoke/crypto";
import {
  detectKaraokeProvider,
  normalizeKaraokeTrackUrl,
} from "@/lib/karaoke/providers";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ConnectionRow = {
  id: string;
  provider: KaraokeMusicProvider;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
};

let spotifyAppTokenCache:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | null = null;

function mapSpotifyTrack(track: {
  id: string;
  name: string;
  duration_ms?: number;
  external_urls?: { spotify?: string };
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
}): KaraokeTrackLink | null {
  if (!track.id || !track.name || !track.external_urls?.spotify) {
    return null;
  }

  return {
    provider: "spotify",
    providerTrackId: track.id,
    url: track.external_urls.spotify,
    title: track.name,
    artist:
      track.artists?.map((artist) => artist.name).filter(Boolean).join(", ") ||
      "Spotify",
    artworkUrl: track.album?.images?.[0]?.url,
    durationMs: track.duration_ms,
    karaokeCapable: false,
    playbackMode: "link_out",
  };
}

function mapAppleMusicTrack(song: {
  id?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    url?: string;
    durationInMillis?: number;
    artwork?: { url?: string };
  };
}): KaraokeTrackLink | null {
  const songId = song.id;
  const attributes = song.attributes;
  if (!songId || !attributes?.name || !attributes.url) {
    return null;
  }

  const artworkUrl = attributes.artwork?.url
    ?.replace("{w}", "400")
    .replace("{h}", "400");

  return {
    provider: "apple_music",
    providerTrackId: songId,
    url: attributes.url,
    title: attributes.name,
    artist: attributes.artistName || "Apple Music",
    artworkUrl,
    durationMs: attributes.durationInMillis,
    karaokeCapable: true,
    playbackMode: "embedded",
  };
}

function extractAppleSongs(payload: unknown): Array<{
  id?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    url?: string;
    durationInMillis?: number;
    artwork?: { url?: string };
  };
}> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as {
    data?: unknown[];
    results?: {
      songs?:
        | { data?: unknown[] }
        | Array<{ data?: unknown[] }>
        | undefined;
    };
  };

  if (Array.isArray(candidate.data)) {
    return candidate.data as Array<{
      id?: string;
      attributes?: {
        name?: string;
        artistName?: string;
        url?: string;
        durationInMillis?: number;
        artwork?: { url?: string };
      };
    }>;
  }

  const songsResult = candidate.results?.songs;
  if (Array.isArray(songsResult)) {
    return songsResult.flatMap((entry) =>
      Array.isArray(entry?.data)
        ? (entry.data as Array<{
            id?: string;
            attributes?: {
              name?: string;
              artistName?: string;
              url?: string;
              durationInMillis?: number;
              artwork?: { url?: string };
            };
          }>)
        : []
    );
  }

  if (songsResult && Array.isArray(songsResult.data)) {
    return songsResult.data as Array<{
      id?: string;
      attributes?: {
        name?: string;
        artistName?: string;
        url?: string;
        durationInMillis?: number;
        artwork?: { url?: string };
      };
    }>;
  }

  return [];
}

async function getProviderConnection(
  supabase: SupabaseClient,
  userId: string,
  provider: KaraokeMusicProvider
) {
  const { data, error } = await supabase
    .from("user_music_connections")
    .select(
      "id, provider, access_token_encrypted, refresh_token_encrypted, expires_at, metadata"
    )
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ConnectionRow | null) ?? null;
}

async function refreshSpotifyUserToken(
  supabase: SupabaseClient,
  connection: ConnectionRow,
  userId: string
) {
  if (!env.karaoke.spotify.clientId || !env.karaoke.spotify.clientSecret) {
    return null;
  }

  if (!connection.refresh_token_encrypted) {
    return null;
  }

  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.karaoke.spotify.clientId}:${env.karaoke.spotify.clientSecret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  const expiresAt =
    typeof payload.expires_in === "number"
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null;

  const { error } = await supabase
    .from("user_music_connections")
    .update({
      access_token_encrypted: payload.access_token
        ? encryptSecret(payload.access_token)
        : connection.access_token_encrypted,
      refresh_token_encrypted: payload.refresh_token
        ? encryptSecret(payload.refresh_token)
        : connection.refresh_token_encrypted,
      expires_at: expiresAt,
    })
    .eq("user_id", userId)
    .eq("provider", "spotify");

  if (error) {
    throw error;
  }

  return payload.access_token;
}

async function getSpotifyUserAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const connection = await getProviderConnection(supabase, userId, "spotify");
  if (!connection?.access_token_encrypted) {
    return null;
  }

  const expiresAt = connection.expires_at ? Date.parse(connection.expires_at) : Number.NaN;
  const expiresSoon = Number.isFinite(expiresAt)
    ? expiresAt <= Date.now() + 60_000
    : false;

  if (expiresSoon) {
    return refreshSpotifyUserToken(supabase, connection, userId);
  }

  return decryptSecret(connection.access_token_encrypted);
}

async function getSpotifyAppAccessToken(): Promise<string | null> {
  if (!env.karaoke.spotify.clientId || !env.karaoke.spotify.clientSecret) {
    return null;
  }

  if (
    spotifyAppTokenCache &&
    spotifyAppTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return spotifyAppTokenCache.accessToken;
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.karaoke.spotify.clientId}:${env.karaoke.spotify.clientSecret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  spotifyAppTokenCache = {
    accessToken: payload.access_token,
    expiresAt:
      Date.now() + (typeof payload.expires_in === "number" ? payload.expires_in * 1000 : 3600_000),
  };

  return spotifyAppTokenCache.accessToken;
}

async function fetchSpotifyTracks(
  endpoint: string,
  accessToken: string
): Promise<KaraokeTrackLink[]> {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    tracks?: { items?: unknown[] };
    items?: Array<{ track?: unknown }>;
  };

  if (Array.isArray(payload.items)) {
    return payload.items
      .map((entry) => mapSpotifyTrack((entry.track ?? {}) as never))
      .filter((track): track is KaraokeTrackLink => track !== null);
  }

  return (payload.tracks?.items ?? [])
    .map((entry) => mapSpotifyTrack(entry as never))
    .filter((track): track is KaraokeTrackLink => track !== null);
}

async function searchSpotifyTracks(
  query: string,
  supabase: SupabaseClient,
  userId: string
) {
  const accessToken =
    (await getSpotifyUserAccessToken(supabase, userId)) ??
    (await getSpotifyAppAccessToken());

  if (!accessToken) {
    return [];
  }

  const endpoint = new URL("https://api.spotify.com/v1/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("type", "track");
  endpoint.searchParams.set("limit", "12");
  return fetchSpotifyTracks(endpoint.toString(), accessToken);
}

async function browseSpotifyTracks(
  supabase: SupabaseClient,
  userId: string
) {
  const accessToken = await getSpotifyUserAccessToken(supabase, userId);
  if (!accessToken) {
    return [];
  }

  const endpoint = new URL("https://api.spotify.com/v1/me/tracks");
  endpoint.searchParams.set("limit", "12");
  return fetchSpotifyTracks(endpoint.toString(), accessToken);
}

async function fetchAppleMusic(
  url: string
): Promise<KaraokeTrackLink[]> {
  if (!env.karaoke.appleMusic.developerToken) {
    return [];
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.karaoke.appleMusic.developerToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return extractAppleSongs(payload)
    .map((song) => mapAppleMusicTrack(song))
    .filter((track): track is KaraokeTrackLink => track !== null);
}

async function searchAppleMusicTracks(query: string, storefront: string) {
  const endpoint = new URL(
    `https://api.music.apple.com/v1/catalog/${storefront}/search`
  );
  endpoint.searchParams.set("term", query);
  endpoint.searchParams.set("types", "songs");
  endpoint.searchParams.set("limit", "12");
  return fetchAppleMusic(endpoint.toString());
}

async function browseAppleMusicTracks(storefront: string) {
  const endpoint = new URL(
    `https://api.music.apple.com/v1/catalog/${storefront}/charts`
  );
  endpoint.searchParams.set("types", "songs");
  endpoint.searchParams.set("limit", "12");
  return fetchAppleMusic(endpoint.toString());
}

async function browseSoundCloudTracks(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("karaoke_item_tracks")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "soundcloud")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    return [];
  }

  return ((data ?? []) as Array<{
    provider: KaraokeMusicProvider;
    provider_track_id: string;
    url: string;
    title: string;
    artist: string;
    artwork_url: string | null;
    duration_ms: number | null;
    karaoke_capable: boolean;
    playback_mode: "embedded" | "link_out";
  }>).map((track) => ({
    provider: track.provider,
    providerTrackId: track.provider_track_id,
    url: track.url,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artwork_url ?? undefined,
    durationMs: track.duration_ms ?? undefined,
    karaokeCapable: track.karaoke_capable,
    playbackMode: track.playback_mode,
  }));
}

async function searchSoundCloudTracks(
  supabase: SupabaseClient,
  userId: string,
  query: string
) {
  const sanitized = query.replace(/[%_]/g, "").trim();
  if (!sanitized) {
    return [];
  }

  const { data, error } = await supabase
    .from("karaoke_item_tracks")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "soundcloud")
    .or(`title.ilike.%${sanitized}%,artist.ilike.%${sanitized}%`)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    return [];
  }

  return ((data ?? []) as Array<{
    provider: KaraokeMusicProvider;
    provider_track_id: string;
    url: string;
    title: string;
    artist: string;
    artwork_url: string | null;
    duration_ms: number | null;
    karaoke_capable: boolean;
    playback_mode: "embedded" | "link_out";
  }>).map((track) => ({
    provider: track.provider,
    providerTrackId: track.provider_track_id,
    url: track.url,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artwork_url ?? undefined,
    durationMs: track.duration_ms ?? undefined,
    karaokeCapable: track.karaoke_capable,
    playbackMode: track.playback_mode,
  }));
}

export async function searchProviderTracks(
  supabase: SupabaseClient,
  userId: string,
  provider: KaraokeMusicProvider,
  query: string
): Promise<KaraokeTrackLink[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const detectedProvider = detectKaraokeProvider(trimmedQuery);
  if (detectedProvider === provider) {
    const normalized = await normalizeKaraokeTrackUrl(trimmedQuery);
    return normalized.provider === "tts" ? [] : [normalized];
  }

  if (provider === "spotify") {
    return searchSpotifyTracks(trimmedQuery, supabase, userId);
  }

  if (provider === "apple_music") {
    return searchAppleMusicTracks(
      trimmedQuery,
      env.karaoke.appleMusic.storefront ?? "us"
    );
  }

  return searchSoundCloudTracks(supabase, userId, trimmedQuery);
}

export async function browseProviderTracks(
  supabase: SupabaseClient,
  userId: string,
  provider: KaraokeMusicProvider
): Promise<KaraokeTrackLink[]> {
  if (provider === "spotify") {
    return browseSpotifyTracks(supabase, userId);
  }

  if (provider === "apple_music") {
    return browseAppleMusicTracks(env.karaoke.appleMusic.storefront ?? "us");
  }

  return browseSoundCloudTracks(supabase, userId);
}
