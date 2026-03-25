import { Buffer } from "buffer";
import { env } from "@/lib/env";
import {
  KaraokeMusicProvider,
  KaraokeTrackLink,
  ProviderCollectionKind,
  ProviderLibraryCollection,
  ProviderLibraryItem,
  ProviderPlaylistSummary,
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

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const CACHE_TTL_MS = 60_000;
const providerCache = new Map<string, CacheEntry>();

let spotifyAppTokenCache:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | null = null;

let soundCloudAppTokenCache:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | null = null;

function getCachedValue<T>(key: string): T | null {
  const cached = providerCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    providerCache.delete(key);
    return null;
  }

  return cached.value as T;
}

async function withProviderCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = getCachedValue<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await loader();
  providerCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return value;
}

function buildSoundCloudTokenHeaders(accessToken: string) {
  return {
    Authorization: `OAuth ${accessToken}`,
    Accept: "application/json; charset=utf-8",
  };
}

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

function mapSpotifyPlaylist(playlist: {
  id?: string;
  name?: string;
  external_urls?: { spotify?: string };
  images?: Array<{ url?: string }>;
  owner?: { display_name?: string };
  tracks?: { total?: number };
}): ProviderPlaylistSummary | null {
  if (!playlist.id || !playlist.name) {
    return null;
  }

  return {
    provider: "spotify",
    playlistId: playlist.id,
    title: playlist.name,
    curator: playlist.owner?.display_name || "Spotify",
    artworkUrl: playlist.images?.[0]?.url,
    url: playlist.external_urls?.spotify,
    trackCount: playlist.tracks?.total ?? 0,
  };
}

function trackToLibraryItem(
  provider: KaraokeMusicProvider,
  track: KaraokeTrackLink
): ProviderLibraryItem {
  return {
    id: `${provider}:track:${track.providerTrackId}`,
    kind: "track",
    provider,
    title: track.title,
    subtitle: track.artist,
    artworkUrl: track.artworkUrl,
    url: track.url,
    durationMs: track.durationMs,
    track,
  };
}

function playlistToLibraryItem(
  provider: KaraokeMusicProvider,
  playlist: ProviderPlaylistSummary
): ProviderLibraryItem {
  return {
    id: `${provider}:playlist:${playlist.playlistId}`,
    kind: "playlist",
    provider,
    title: playlist.title,
    subtitle: playlist.curator,
    artworkUrl: playlist.artworkUrl,
    url: playlist.url,
    playlist,
  };
}

function buildCollection(args: {
  provider: KaraokeMusicProvider;
  key: ProviderCollectionKind;
  label: string;
  description?: string;
  items: ProviderLibraryItem[];
  cursor?: string | null;
  connected: boolean;
  emptyMessage?: string;
}): ProviderLibraryCollection {
  return {
    provider: args.provider,
    key: args.key,
    kind: args.key,
    label: args.label,
    description: args.description,
    items: args.items,
    cursor: args.cursor ?? null,
    hasMore: Boolean(args.cursor),
    connected: args.connected,
    emptyMessage: args.emptyMessage,
  };
}

function asNextCursor(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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

async function refreshSoundCloudUserToken(
  supabase: SupabaseClient,
  connection: ConnectionRow,
  userId: string
) {
  if (!env.karaoke.soundcloud.clientId || !env.karaoke.soundcloud.clientSecret) {
    return null;
  }

  if (!connection.refresh_token_encrypted) {
    return null;
  }

  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  const response = await fetch("https://secure.soundcloud.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json; charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.karaoke.soundcloud.clientId,
      client_secret: env.karaoke.soundcloud.clientSecret,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
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
    .eq("provider", "soundcloud");

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
      Date.now() +
      (typeof payload.expires_in === "number" ? payload.expires_in * 1000 : 3600_000),
  };

  return spotifyAppTokenCache.accessToken;
}

async function getSoundCloudUserAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const connection = await getProviderConnection(supabase, userId, "soundcloud");
  if (!connection?.access_token_encrypted) {
    return null;
  }

  const expiresAt = connection.expires_at ? Date.parse(connection.expires_at) : Number.NaN;
  const expiresSoon = Number.isFinite(expiresAt)
    ? expiresAt <= Date.now() + 60_000
    : false;

  if (expiresSoon) {
    return refreshSoundCloudUserToken(supabase, connection, userId);
  }

  return decryptSecret(connection.access_token_encrypted);
}

async function getSoundCloudAppAccessToken(): Promise<string | null> {
  if (!env.karaoke.soundcloud.clientId || !env.karaoke.soundcloud.clientSecret) {
    return null;
  }

  if (
    soundCloudAppTokenCache &&
    soundCloudAppTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return soundCloudAppTokenCache.accessToken;
  }

  const response = await fetch("https://secure.soundcloud.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json; charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.karaoke.soundcloud.clientId,
      client_secret: env.karaoke.soundcloud.clientSecret,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  soundCloudAppTokenCache = {
    accessToken: payload.access_token,
    expiresAt:
      Date.now() +
      (typeof payload.expires_in === "number" ? payload.expires_in * 1000 : 3600_000),
  };

  return soundCloudAppTokenCache.accessToken;
}

async function getAppleMusicUserToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const connection = await getProviderConnection(supabase, userId, "apple_music");
  if (!connection?.access_token_encrypted) {
    return null;
  }

  return decryptSecret(connection.access_token_encrypted);
}

async function fetchSpotifyJson<T>(endpoint: string, accessToken: string): Promise<T | null> {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

async function fetchAppleMusicJson<T>(
  endpoint: string,
  musicUserToken: string
): Promise<T | null> {
  if (!env.karaoke.appleMusic.developerToken) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${env.karaoke.appleMusic.developerToken}`,
      "Music-User-Token": musicUserToken,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

async function fetchSoundCloudJson<T>(
  endpoint: string,
  accessToken: string
): Promise<T | null> {
  const response = await fetch(endpoint, {
    headers: buildSoundCloudTokenHeaders(accessToken),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

function extractSpotifyTracks(payload: {
  tracks?: { items?: unknown[]; next?: string | null };
  items?: Array<{ track?: unknown }>;
  next?: string | null;
}) {
  const tracks = Array.isArray(payload.items)
    ? payload.items
        .map((entry) => mapSpotifyTrack((entry.track ?? {}) as never))
        .filter((track): track is KaraokeTrackLink => track !== null)
    : (payload.tracks?.items ?? [])
        .map((entry) => mapSpotifyTrack(entry as never))
        .filter((track): track is KaraokeTrackLink => track !== null);

  return {
    tracks,
    cursor: asNextCursor(payload.next ?? payload.tracks?.next),
  };
}

function extractSpotifyPlaylists(payload: {
  items?: unknown[];
  next?: string | null;
}) {
  const playlists = (payload.items ?? [])
    .map((entry) => mapSpotifyPlaylist(entry as never))
    .filter((playlist): playlist is ProviderPlaylistSummary => playlist !== null);

  return {
    playlists,
    cursor: asNextCursor(payload.next),
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
}, storefront: string): KaraokeTrackLink | null {
  const songId = song.id;
  const attributes = song.attributes;
  if (!songId || !attributes?.name) {
    return null;
  }

  const artworkUrl = attributes.artwork?.url
    ?.replace("{w}", "400")
    .replace("{h}", "400");

  return {
    provider: "apple_music",
    providerTrackId: songId,
    url: attributes.url || `https://music.apple.com/${storefront}/song/${songId}`,
    title: attributes.name,
    artist: attributes.artistName || "Apple Music",
    artworkUrl,
    durationMs: attributes.durationInMillis,
    karaokeCapable: true,
    playbackMode: "embedded",
  };
}

function mapAppleMusicPlaylist(playlist: {
  id?: string;
  attributes?: {
    name?: string;
    curatorName?: string;
    artwork?: { url?: string };
    description?: { standard?: string };
    playParams?: { globalId?: string };
    url?: string;
    trackCount?: number;
  };
}, storefront: string): ProviderPlaylistSummary | null {
  const playlistId = playlist.id;
  const attributes = playlist.attributes;
  if (!playlistId || !attributes?.name) {
    return null;
  }

  const artworkUrl = attributes.artwork?.url
    ?.replace("{w}", "400")
    .replace("{h}", "400");

  return {
    provider: "apple_music",
    playlistId,
    title: attributes.name,
    curator: attributes.curatorName || "Apple Music",
    artworkUrl,
    url:
      attributes.url ||
      (attributes.playParams?.globalId
        ? `https://music.apple.com/${storefront}/playlist/${attributes.playParams.globalId}`
        : undefined),
    description: attributes.description?.standard,
    trackCount: attributes.trackCount ?? 0,
  };
}

function extractAppleSongs(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      songs: [] as Array<{
        id?: string;
        attributes?: {
          name?: string;
          artistName?: string;
          url?: string;
          durationInMillis?: number;
          artwork?: { url?: string };
        };
      }>,
      cursor: null as string | null,
    };
  }

  const candidate = payload as {
    data?: unknown[];
    next?: string | null;
    results?: {
      songs?:
        | { data?: unknown[]; next?: string | null }
        | Array<{ data?: unknown[]; next?: string | null }>
        | undefined;
    };
  };

  if (Array.isArray(candidate.data)) {
    return {
      songs: candidate.data as Array<{
        id?: string;
        attributes?: {
          name?: string;
          artistName?: string;
          url?: string;
          durationInMillis?: number;
          artwork?: { url?: string };
        };
      }>,
      cursor: asNextCursor(candidate.next),
    };
  }

  const songsResult = candidate.results?.songs;
  if (Array.isArray(songsResult)) {
    const data = songsResult.flatMap((entry) => (Array.isArray(entry?.data) ? entry.data : []));
    const next = songsResult.find((entry) => typeof entry?.next === "string")?.next ?? null;
    return {
      songs: data as Array<{
        id?: string;
        attributes?: {
          name?: string;
          artistName?: string;
          url?: string;
          durationInMillis?: number;
          artwork?: { url?: string };
        };
      }>,
      cursor: asNextCursor(next),
    };
  }

  if (songsResult && Array.isArray(songsResult.data)) {
    return {
      songs: songsResult.data as Array<{
        id?: string;
        attributes?: {
          name?: string;
          artistName?: string;
          url?: string;
          durationInMillis?: number;
          artwork?: { url?: string };
        };
      }>,
      cursor: asNextCursor(songsResult.next),
    };
  }

  return {
    songs: [],
    cursor: null,
  };
}

function extractApplePlaylists(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      playlists: [] as Array<{
        id?: string;
        attributes?: {
          name?: string;
          curatorName?: string;
          artwork?: { url?: string };
          description?: { standard?: string };
          playParams?: { globalId?: string };
          url?: string;
          trackCount?: number;
        };
      }>,
      cursor: null as string | null,
    };
  }

  const candidate = payload as {
    data?: unknown[];
    next?: string | null;
  };

  return {
    playlists: (candidate.data ?? []) as Array<{
      id?: string;
      attributes?: {
        name?: string;
        curatorName?: string;
        artwork?: { url?: string };
        description?: { standard?: string };
        playParams?: { globalId?: string };
        url?: string;
        trackCount?: number;
      };
    }>,
    cursor: asNextCursor(candidate.next),
  };
}

function mapAppleRecentItems(payload: unknown, storefront: string) {
  if (!payload || typeof payload !== "object") {
    return {
      items: [] as ProviderLibraryItem[],
      cursor: null as string | null,
    };
  }

  const candidate = payload as {
    data?: unknown[];
    next?: string | null;
  };

  const items = (candidate.data ?? [])
    .map((entry) => {
      const typed = entry as {
        id?: string;
        type?: string;
        attributes?: {
          name?: string;
          artistName?: string;
          url?: string;
          durationInMillis?: number;
          artwork?: { url?: string };
          curatorName?: string;
          description?: { standard?: string };
          trackCount?: number;
          playParams?: { globalId?: string };
        };
      };

      if (typed.type?.includes("playlist")) {
        const playlist = mapAppleMusicPlaylist(typed as never, storefront);
        return playlist ? playlistToLibraryItem("apple_music", playlist) : null;
      }

      const track = mapAppleMusicTrack(typed as never, storefront);
      return track ? trackToLibraryItem("apple_music", track) : null;
    })
    .filter((entry): entry is ProviderLibraryItem => entry !== null);

  return {
    items,
    cursor: asNextCursor(candidate.next),
  };
}

function mapSoundCloudTrack(track: {
  id?: number | string;
  title?: string;
  permalink_url?: string;
  duration?: number;
  artwork_url?: string;
  user?: { username?: string };
}): KaraokeTrackLink | null {
  if (!track.id || !track.title || !track.permalink_url) {
    return null;
  }

  return {
    provider: "soundcloud",
    providerTrackId: String(track.id),
    url: track.permalink_url,
    title: track.title,
    artist: track.user?.username || "SoundCloud",
    artworkUrl: track.artwork_url ?? undefined,
    durationMs: track.duration ?? undefined,
    karaokeCapable: true,
    playbackMode: "embedded",
  };
}

function mapSoundCloudPlaylist(playlist: {
  id?: number | string;
  title?: string;
  permalink_url?: string;
  artwork_url?: string;
  user?: { username?: string };
  track_count?: number;
  tracks?: unknown[];
}): ProviderPlaylistSummary | null {
  if (!playlist.id || !playlist.title) {
    return null;
  }

  return {
    provider: "soundcloud",
    playlistId: String(playlist.id),
    title: playlist.title,
    curator: playlist.user?.username || "SoundCloud",
    artworkUrl: playlist.artwork_url ?? undefined,
    url: playlist.permalink_url ?? undefined,
    trackCount:
      typeof playlist.track_count === "number"
        ? playlist.track_count
        : Array.isArray(playlist.tracks)
          ? playlist.tracks.length
          : 0,
  };
}

async function fetchSpotifyTracks(
  endpoint: string,
  accessToken: string
): Promise<KaraokeTrackLink[]> {
  const payload = await fetchSpotifyJson<{
    tracks?: { items?: unknown[] };
    items?: Array<{ track?: unknown }>;
  }>(endpoint, accessToken);

  if (!payload) {
    return [];
  }

  return extractSpotifyTracks(payload).tracks;
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
  const library = await loadProviderLibrary(supabase, userId, "spotify");
  return library.find((collection) => collection.key === "tracks")?.items
    .map((item) => item.track)
    .filter((track): track is KaraokeTrackLink => Boolean(track)) ?? [];
}

async function searchAppleMusicTracks(query: string, storefront: string) {
  const endpoint = new URL(
    `https://api.music.apple.com/v1/catalog/${storefront}/search`
  );
  endpoint.searchParams.set("term", query);
  endpoint.searchParams.set("types", "songs");
  endpoint.searchParams.set("limit", "12");

  if (!env.karaoke.appleMusic.developerToken) {
    return [];
  }

  const response = await fetch(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${env.karaoke.appleMusic.developerToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return extractAppleSongs(payload).songs
    .map((song) => mapAppleMusicTrack(song, storefront))
    .filter((track): track is KaraokeTrackLink => track !== null);
}

async function browseAppleMusicTracks(
  supabase: SupabaseClient,
  userId: string
) {
  const library = await loadProviderLibrary(supabase, userId, "apple_music");
  return library.find((collection) => collection.key === "tracks")?.items
    .map((item) => item.track)
    .filter((track): track is KaraokeTrackLink => Boolean(track)) ?? [];
}

async function searchSoundCloudTracks(
  supabase: SupabaseClient,
  userId: string,
  query: string
) {
  const accessToken =
    (await getSoundCloudUserAccessToken(supabase, userId)) ??
    (await getSoundCloudAppAccessToken());

  if (!accessToken) {
    return [];
  }

  const endpoint = new URL("https://api.soundcloud.com/tracks");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "12");
  endpoint.searchParams.set("access", "playable");

  const payload = await fetchSoundCloudJson<{
    collection?: unknown[];
  }>(endpoint.toString(), accessToken);

  return (payload?.collection ?? [])
    .map((entry) => mapSoundCloudTrack(entry as never))
    .filter((track): track is KaraokeTrackLink => track !== null);
}

async function browseSoundCloudTracks(
  supabase: SupabaseClient,
  userId: string
) {
  const library = await loadProviderLibrary(supabase, userId, "soundcloud");
  return library.find((collection) => collection.key === "tracks")?.items
    .map((item) => item.track)
    .filter((track): track is KaraokeTrackLink => Boolean(track)) ?? [];
}

async function loadSpotifyLibrary(
  supabase: SupabaseClient,
  userId: string
): Promise<ProviderLibraryCollection[]> {
  const accessToken = await getSpotifyUserAccessToken(supabase, userId);
  if (!accessToken) {
    return [
      buildCollection({
        provider: "spotify",
        key: "tracks",
        label: "Saved tracks",
        items: [],
        connected: false,
        emptyMessage: "Connect Spotify to browse your saved tracks.",
      }),
      buildCollection({
        provider: "spotify",
        key: "playlists",
        label: "Playlists",
        items: [],
        connected: false,
        emptyMessage: "Connect Spotify to browse your playlists.",
      }),
      buildCollection({
        provider: "spotify",
        key: "recents",
        label: "Recently played",
        items: [],
        connected: false,
        emptyMessage: "Connect Spotify to browse your recent listening history.",
      }),
    ];
  }

  return withProviderCache(`spotify:${userId}:library`, async () => {
    const [tracksPayload, playlistsPayload, recentsPayload] = await Promise.all([
      fetchSpotifyJson<{
        items?: Array<{ track?: unknown }>;
        next?: string | null;
      }>("https://api.spotify.com/v1/me/tracks?limit=12", accessToken),
      fetchSpotifyJson<{
        items?: unknown[];
        next?: string | null;
      }>("https://api.spotify.com/v1/me/playlists?limit=12", accessToken),
      fetchSpotifyJson<{
        items?: Array<{ track?: unknown }>;
        next?: string | null;
      }>("https://api.spotify.com/v1/me/player/recently-played?limit=12", accessToken),
    ]);

    const savedTracks = extractSpotifyTracks(tracksPayload ?? {}).tracks.map((track) =>
      trackToLibraryItem("spotify", track)
    );
    const playlists = extractSpotifyPlaylists(playlistsPayload ?? {}).playlists.map((playlist) =>
      playlistToLibraryItem("spotify", playlist)
    );
    const recents = extractSpotifyTracks(recentsPayload ?? {}).tracks.map((track) =>
      trackToLibraryItem("spotify", track)
    );

    return [
      buildCollection({
        provider: "spotify",
        key: "tracks",
        label: "Saved tracks",
        items: savedTracks,
        cursor: extractSpotifyTracks(tracksPayload ?? {}).cursor,
        connected: true,
      }),
      buildCollection({
        provider: "spotify",
        key: "playlists",
        label: "Playlists",
        items: playlists,
        cursor: extractSpotifyPlaylists(playlistsPayload ?? {}).cursor,
        connected: true,
      }),
      buildCollection({
        provider: "spotify",
        key: "recents",
        label: "Recently played",
        items: recents,
        cursor: extractSpotifyTracks(recentsPayload ?? {}).cursor,
        connected: true,
      }),
    ];
  });
}

async function loadAppleMusicLibrary(
  supabase: SupabaseClient,
  userId: string
): Promise<ProviderLibraryCollection[]> {
  const musicUserToken = await getAppleMusicUserToken(supabase, userId);
  const storefront = env.karaoke.appleMusic.storefront ?? "us";

  if (!musicUserToken) {
    return [
      buildCollection({
        provider: "apple_music",
        key: "tracks",
        label: "Library songs",
        items: [],
        connected: false,
        emptyMessage: "Connect Apple Music to browse your library songs.",
      }),
      buildCollection({
        provider: "apple_music",
        key: "playlists",
        label: "Library playlists",
        items: [],
        connected: false,
        emptyMessage: "Connect Apple Music to browse your playlists.",
      }),
      buildCollection({
        provider: "apple_music",
        key: "recents",
        label: "Recently added",
        items: [],
        connected: false,
        emptyMessage: "Connect Apple Music to browse recent additions.",
      }),
    ];
  }

  return withProviderCache(`apple_music:${userId}:library`, async () => {
    const [songsPayload, playlistsPayload, recentPayload] = await Promise.all([
      fetchAppleMusicJson<unknown>(
        "https://api.music.apple.com/v1/me/library/songs?limit=12",
        musicUserToken
      ),
      fetchAppleMusicJson<unknown>(
        "https://api.music.apple.com/v1/me/library/playlists?limit=12",
        musicUserToken
      ),
      fetchAppleMusicJson<unknown>(
        "https://api.music.apple.com/v1/me/library/recently-added?limit=12",
        musicUserToken
      ),
    ]);

    const extractedSongs = extractAppleSongs(songsPayload);
    const extractedPlaylists = extractApplePlaylists(playlistsPayload);
    const recentItems = mapAppleRecentItems(recentPayload, storefront);

    return [
      buildCollection({
        provider: "apple_music",
        key: "tracks",
        label: "Library songs",
        items: extractedSongs.songs
          .map((song) => mapAppleMusicTrack(song, storefront))
          .filter((track): track is KaraokeTrackLink => track !== null)
          .map((track) => trackToLibraryItem("apple_music", track)),
        cursor: extractedSongs.cursor,
        connected: true,
      }),
      buildCollection({
        provider: "apple_music",
        key: "playlists",
        label: "Library playlists",
        items: extractedPlaylists.playlists
          .map((playlist) => mapAppleMusicPlaylist(playlist, storefront))
          .filter((playlist): playlist is ProviderPlaylistSummary => playlist !== null)
          .map((playlist) => playlistToLibraryItem("apple_music", playlist)),
        cursor: extractedPlaylists.cursor,
        connected: true,
      }),
      buildCollection({
        provider: "apple_music",
        key: "recents",
        label: "Recently added",
        items: recentItems.items,
        cursor: recentItems.cursor,
        connected: true,
      }),
    ];
  });
}

async function loadSoundCloudLibrary(
  supabase: SupabaseClient,
  userId: string
): Promise<ProviderLibraryCollection[]> {
  const accessToken = await getSoundCloudUserAccessToken(supabase, userId);
  if (!accessToken) {
    return [
      buildCollection({
        provider: "soundcloud",
        key: "tracks",
        label: "Your uploads",
        items: [],
        connected: false,
        emptyMessage: "Connect SoundCloud to browse your uploads.",
      }),
      buildCollection({
        provider: "soundcloud",
        key: "playlists",
        label: "Playlists",
        items: [],
        connected: false,
        emptyMessage: "Connect SoundCloud to browse your playlists.",
      }),
      buildCollection({
        provider: "soundcloud",
        key: "recents",
        label: "Liked tracks",
        items: [],
        connected: false,
        emptyMessage: "Connect SoundCloud to browse your liked tracks.",
      }),
    ];
  }

  return withProviderCache(`soundcloud:${userId}:library`, async () => {
    const [uploadsPayload, playlistsPayload, likesPayload] = await Promise.all([
      fetchSoundCloudJson<{
        collection?: unknown[];
        next_href?: string | null;
      }>("https://api.soundcloud.com/me/tracks?limit=12&linked_partitioning=true", accessToken),
      fetchSoundCloudJson<{
        collection?: unknown[];
        next_href?: string | null;
      }>("https://api.soundcloud.com/me/playlists?show_tracks=false&limit=12&linked_partitioning=true", accessToken),
      fetchSoundCloudJson<{
        collection?: Array<{ track?: unknown } | unknown>;
        next_href?: string | null;
      }>("https://api.soundcloud.com/me/likes/tracks?limit=12&linked_partitioning=true", accessToken),
    ]);

    const uploads = (uploadsPayload?.collection ?? [])
      .map((entry) => mapSoundCloudTrack(entry as never))
      .filter((track): track is KaraokeTrackLink => track !== null)
      .map((track) => trackToLibraryItem("soundcloud", track));

    const playlists = (playlistsPayload?.collection ?? [])
      .map((entry) => mapSoundCloudPlaylist(entry as never))
      .filter((playlist): playlist is ProviderPlaylistSummary => playlist !== null)
      .map((playlist) => playlistToLibraryItem("soundcloud", playlist));

    const likedTracks = (likesPayload?.collection ?? [])
      .map((entry) => {
        const candidate =
          entry && typeof entry === "object" && "track" in entry
            ? (entry as { track?: unknown }).track
            : entry;
        return mapSoundCloudTrack(candidate as never);
      })
      .filter((track): track is KaraokeTrackLink => track !== null)
      .map((track) => trackToLibraryItem("soundcloud", track));

    return [
      buildCollection({
        provider: "soundcloud",
        key: "tracks",
        label: "Your uploads",
        items: uploads,
        cursor: asNextCursor(uploadsPayload?.next_href),
        connected: true,
      }),
      buildCollection({
        provider: "soundcloud",
        key: "playlists",
        label: "Playlists",
        items: playlists,
        cursor: asNextCursor(playlistsPayload?.next_href),
        connected: true,
      }),
      buildCollection({
        provider: "soundcloud",
        key: "recents",
        label: "Liked tracks",
        items: likedTracks,
        cursor: asNextCursor(likesPayload?.next_href),
        connected: true,
      }),
    ];
  });
}

export async function loadProviderLibrary(
  supabase: SupabaseClient,
  userId: string,
  provider: KaraokeMusicProvider
): Promise<ProviderLibraryCollection[]> {
  if (provider === "spotify") {
    return loadSpotifyLibrary(supabase, userId);
  }

  if (provider === "apple_music") {
    return loadAppleMusicLibrary(supabase, userId);
  }

  return loadSoundCloudLibrary(supabase, userId);
}

async function fetchSpotifyCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionKey: ProviderCollectionKind,
  cursor?: string | null
) {
  const accessToken = await getSpotifyUserAccessToken(supabase, userId);
  if (!accessToken) {
    return buildCollection({
      provider: "spotify",
      key: collectionKey,
      label: collectionKey === "tracks" ? "Saved tracks" : collectionKey === "playlists" ? "Playlists" : "Recently played",
      items: [],
      connected: false,
      emptyMessage: "Connect Spotify to browse this collection.",
    });
  }

  const endpoint =
    cursor ||
    (collectionKey === "tracks"
      ? "https://api.spotify.com/v1/me/tracks?limit=24"
      : collectionKey === "playlists"
        ? "https://api.spotify.com/v1/me/playlists?limit=24"
        : "https://api.spotify.com/v1/me/player/recently-played?limit=24");

  if (collectionKey === "playlists") {
    const payload = await fetchSpotifyJson<{
      items?: unknown[];
      next?: string | null;
    }>(endpoint, accessToken);
    const playlists = extractSpotifyPlaylists(payload ?? {});
    return buildCollection({
      provider: "spotify",
      key: collectionKey,
      label: "Playlists",
      items: playlists.playlists.map((playlist) =>
        playlistToLibraryItem("spotify", playlist)
      ),
      cursor: playlists.cursor,
      connected: true,
    });
  }

  const payload = await fetchSpotifyJson<{
    items?: Array<{ track?: unknown }>;
    tracks?: { items?: unknown[]; next?: string | null };
    next?: string | null;
  }>(endpoint, accessToken);
  const tracks = extractSpotifyTracks(payload ?? {});

  return buildCollection({
    provider: "spotify",
    key: collectionKey,
    label: collectionKey === "tracks" ? "Saved tracks" : "Recently played",
    items: tracks.tracks.map((track) => trackToLibraryItem("spotify", track)),
    cursor: tracks.cursor,
    connected: true,
  });
}

async function fetchAppleMusicCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionKey: ProviderCollectionKind,
  cursor?: string | null
) {
  const musicUserToken = await getAppleMusicUserToken(supabase, userId);
  const storefront = env.karaoke.appleMusic.storefront ?? "us";
  if (!musicUserToken) {
    return buildCollection({
      provider: "apple_music",
      key: collectionKey,
      label: collectionKey === "tracks" ? "Library songs" : collectionKey === "playlists" ? "Library playlists" : "Recently added",
      items: [],
      connected: false,
      emptyMessage: "Connect Apple Music to browse this collection.",
    });
  }

  const endpoint =
    cursor ||
    (collectionKey === "tracks"
      ? "https://api.music.apple.com/v1/me/library/songs?limit=24"
      : collectionKey === "playlists"
        ? "https://api.music.apple.com/v1/me/library/playlists?limit=24"
        : "https://api.music.apple.com/v1/me/library/recently-added?limit=24");

  const payload = await fetchAppleMusicJson<unknown>(endpoint, musicUserToken);
  if (collectionKey === "playlists") {
    const playlists = extractApplePlaylists(payload);
    return buildCollection({
      provider: "apple_music",
      key: collectionKey,
      label: "Library playlists",
      items: playlists.playlists
        .map((playlist) => mapAppleMusicPlaylist(playlist, storefront))
        .filter((playlist): playlist is ProviderPlaylistSummary => playlist !== null)
        .map((playlist) => playlistToLibraryItem("apple_music", playlist)),
      cursor: playlists.cursor,
      connected: true,
    });
  }

  if (collectionKey === "recents") {
    const recents = mapAppleRecentItems(payload, storefront);
    return buildCollection({
      provider: "apple_music",
      key: collectionKey,
      label: "Recently added",
      items: recents.items,
      cursor: recents.cursor,
      connected: true,
    });
  }

  const songs = extractAppleSongs(payload);
  return buildCollection({
    provider: "apple_music",
    key: collectionKey,
    label: "Library songs",
    items: songs.songs
      .map((song) => mapAppleMusicTrack(song, storefront))
      .filter((track): track is KaraokeTrackLink => track !== null)
      .map((track) => trackToLibraryItem("apple_music", track)),
    cursor: songs.cursor,
    connected: true,
  });
}

async function fetchSoundCloudCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionKey: ProviderCollectionKind,
  cursor?: string | null
) {
  const accessToken = await getSoundCloudUserAccessToken(supabase, userId);
  if (!accessToken) {
    return buildCollection({
      provider: "soundcloud",
      key: collectionKey,
      label: collectionKey === "tracks" ? "Your uploads" : collectionKey === "playlists" ? "Playlists" : "Liked tracks",
      items: [],
      connected: false,
      emptyMessage: "Connect SoundCloud to browse this collection.",
    });
  }

  const endpoint =
    cursor ||
    (collectionKey === "tracks"
      ? "https://api.soundcloud.com/me/tracks?limit=24&linked_partitioning=true"
      : collectionKey === "playlists"
        ? "https://api.soundcloud.com/me/playlists?show_tracks=false&limit=24&linked_partitioning=true"
        : "https://api.soundcloud.com/me/likes/tracks?limit=24&linked_partitioning=true");

  const payload = await fetchSoundCloudJson<{
    collection?: Array<{ track?: unknown } | unknown>;
    next_href?: string | null;
  }>(endpoint, accessToken);

  if (collectionKey === "playlists") {
    return buildCollection({
      provider: "soundcloud",
      key: collectionKey,
      label: "Playlists",
      items: (payload?.collection ?? [])
        .map((entry) => mapSoundCloudPlaylist(entry as never))
        .filter((playlist): playlist is ProviderPlaylistSummary => playlist !== null)
        .map((playlist) => playlistToLibraryItem("soundcloud", playlist)),
      cursor: asNextCursor(payload?.next_href),
      connected: true,
    });
  }

  return buildCollection({
    provider: "soundcloud",
    key: collectionKey,
    label: collectionKey === "tracks" ? "Your uploads" : "Liked tracks",
    items: (payload?.collection ?? [])
      .map((entry) => {
        const candidate =
          entry && typeof entry === "object" && "track" in entry
            ? (entry as { track?: unknown }).track
            : entry;
        return mapSoundCloudTrack(candidate as never);
      })
      .filter((track): track is KaraokeTrackLink => track !== null)
      .map((track) => trackToLibraryItem("soundcloud", track)),
    cursor: asNextCursor(payload?.next_href),
    connected: true,
  });
}

export async function loadProviderCollection(
  supabase: SupabaseClient,
  userId: string,
  provider: KaraokeMusicProvider,
  collectionKey: ProviderCollectionKind,
  cursor?: string | null
) {
  if (provider === "spotify") {
    return fetchSpotifyCollection(supabase, userId, collectionKey, cursor);
  }

  if (provider === "apple_music") {
    return fetchAppleMusicCollection(supabase, userId, collectionKey, cursor);
  }

  return fetchSoundCloudCollection(supabase, userId, collectionKey, cursor);
}

export async function loadProviderPlaylistTracks(
  supabase: SupabaseClient,
  userId: string,
  provider: KaraokeMusicProvider,
  playlistId: string,
  cursor?: string | null
): Promise<{
  playlist: ProviderPlaylistSummary | null;
  items: ProviderLibraryItem[];
  cursor: string | null;
}> {
  if (provider === "spotify") {
    const accessToken = await getSpotifyUserAccessToken(supabase, userId);
    if (!accessToken) {
      return {
        playlist: null,
        items: [],
        cursor: null,
      };
    }

    const playlistPayload = await fetchSpotifyJson<{
      id?: string;
      name?: string;
      external_urls?: { spotify?: string };
      images?: Array<{ url?: string }>;
      owner?: { display_name?: string };
      tracks?: { total?: number };
    }>(`https://api.spotify.com/v1/playlists/${playlistId}`, accessToken);

    const tracksPayload = await fetchSpotifyJson<{
      items?: Array<{ track?: unknown }>;
      next?: string | null;
    }>(
      cursor ||
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
      accessToken
    );

    const playlist = playlistPayload ? mapSpotifyPlaylist(playlistPayload) : null;
    const tracks = extractSpotifyTracks(tracksPayload ?? {});
    return {
      playlist,
      items: tracks.tracks.map((track) => trackToLibraryItem("spotify", track)),
      cursor: tracks.cursor,
    };
  }

  if (provider === "apple_music") {
    const musicUserToken = await getAppleMusicUserToken(supabase, userId);
    const storefront = env.karaoke.appleMusic.storefront ?? "us";
    if (!musicUserToken) {
      return {
        playlist: null,
        items: [],
        cursor: null,
      };
    }

    const playlistPayload = await fetchAppleMusicJson<unknown>(
      `https://api.music.apple.com/v1/me/library/playlists/${playlistId}`,
      musicUserToken
    );
    const tracksPayload = await fetchAppleMusicJson<unknown>(
      cursor ||
        `https://api.music.apple.com/v1/me/library/playlists/${playlistId}/tracks?limit=50`,
      musicUserToken
    );

    const playlist = extractApplePlaylists(playlistPayload).playlists
      .map((entry) => mapAppleMusicPlaylist(entry, storefront))
      .find((entry): entry is ProviderPlaylistSummary => entry !== null) ?? null;
    const tracks = extractAppleSongs(tracksPayload);

    return {
      playlist,
      items: tracks.songs
        .map((song) => mapAppleMusicTrack(song, storefront))
        .filter((track): track is KaraokeTrackLink => track !== null)
        .map((track) => trackToLibraryItem("apple_music", track)),
      cursor: tracks.cursor,
    };
  }

  const accessToken = await getSoundCloudUserAccessToken(supabase, userId);
  if (!accessToken) {
    return {
      playlist: null,
      items: [],
      cursor: null,
    };
  }

  const payload = await fetchSoundCloudJson<{
    id?: number | string;
    title?: string;
    permalink_url?: string;
    artwork_url?: string;
    user?: { username?: string };
    track_count?: number;
    tracks?: unknown[];
  }>(
    cursor || `https://api.soundcloud.com/playlists/${playlistId}`,
    accessToken
  );

  const playlist = payload ? mapSoundCloudPlaylist(payload) : null;
  const items = (payload?.tracks ?? [])
    .map((track) => mapSoundCloudTrack(track as never))
    .filter((track): track is KaraokeTrackLink => track !== null)
    .map((track) => trackToLibraryItem("soundcloud", track));

  return {
    playlist,
    items,
    cursor: null,
  };
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
    return browseAppleMusicTracks(supabase, userId);
  }

  return browseSoundCloudTracks(supabase, userId);
}
