import { KaraokePlaybackProvider, KaraokeTrackLink } from "@/types/database";

const SPOTIFY_HOSTS = new Set(["open.spotify.com", "spotify.link"]);
const APPLE_MUSIC_HOSTS = new Set(["music.apple.com", "itunes.apple.com"]);
const SOUNDCLOUD_HOSTS = new Set(["soundcloud.com", "m.soundcloud.com"]);

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractMetaTag(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return null;
}

function inferTitleFromPath(url: URL): string {
  const segment = url.pathname
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/[-_]+/g, " ")
    .trim();
  return segment || url.hostname;
}

function splitTitleAndArtist(title: string, fallbackArtist: string): { title: string; artist: string } {
  const separators = [" - ", " by "];
  for (const separator of separators) {
    const parts = title.split(separator);
    if (parts.length >= 2) {
      return {
        title: parts[0].trim(),
        artist: parts.slice(1).join(separator).trim() || fallbackArtist,
      };
    }
  }

  return {
    title: title.trim(),
    artist: fallbackArtist,
  };
}

function parseSpotifyTrackId(url: URL): string | null {
  if (url.protocol === "spotify:") {
    const [, type, id] = url.href.split(":");
    return type === "track" && id ? id : null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "track" && segments[1]) {
    return segments[1];
  }

  return null;
}

function parseAppleMusicTrackId(url: URL): string | null {
  const songId = url.searchParams.get("i");
  if (songId) return songId;

  const segments = url.pathname.split("/").filter(Boolean);
  const songIndex = segments.findIndex((segment) => segment === "song");
  if (songIndex >= 0 && segments[songIndex + 1]) {
    return segments[songIndex + 1];
  }

  return segments.at(-1) ?? null;
}

function getProviderFromUrl(url: URL): KaraokePlaybackProvider | null {
  if (url.protocol === "spotify:") return "spotify";
  if (SPOTIFY_HOSTS.has(url.hostname)) return "spotify";
  if (APPLE_MUSIC_HOSTS.has(url.hostname)) return "apple_music";
  if (SOUNDCLOUD_HOSTS.has(url.hostname)) return "soundcloud";
  return null;
}

export function detectKaraokeProvider(rawUrl: string): KaraokePlaybackProvider | null {
  try {
    return getProviderFromUrl(new URL(rawUrl));
  } catch {
    return null;
  }
}

async function fetchOpenGraphMetadata(rawUrl: string) {
  const response = await fetch(rawUrl, {
    headers: {
      "User-Agent": "iLiterateKaraoke/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch track metadata (${response.status})`);
  }

  const html = await response.text();
  return {
    title:
      extractMetaTag(html, "og:title") ??
      extractMetaTag(html, "twitter:title") ??
      extractMetaTag(html, "title"),
    description:
      extractMetaTag(html, "og:description") ??
      extractMetaTag(html, "twitter:description"),
    image:
      extractMetaTag(html, "og:image") ??
      extractMetaTag(html, "twitter:image"),
    html,
  };
}

async function normalizeSpotifyTrack(url: URL): Promise<KaraokeTrackLink> {
  const providerTrackId = parseSpotifyTrackId(url) ?? url.toString();
  const metadata = await fetchOpenGraphMetadata(url.toString());
  const fallbackTitle = inferTitleFromPath(url);
  const description = metadata.description ? stripHtml(metadata.description) : "";
  const split = splitTitleAndArtist(metadata.title ?? fallbackTitle, description || "Spotify");

  return {
    provider: "spotify",
    providerTrackId,
    url: url.toString(),
    title: split.title || fallbackTitle,
    artist: split.artist || "Spotify",
    artworkUrl: metadata.image ?? undefined,
    karaokeCapable: false,
    playbackMode: "link_out",
  };
}

async function normalizeAppleMusicTrack(url: URL): Promise<KaraokeTrackLink> {
  const providerTrackId = parseAppleMusicTrackId(url) ?? url.toString();
  const metadata = await fetchOpenGraphMetadata(url.toString());
  const fallbackTitle = inferTitleFromPath(url);
  const description = metadata.description ? stripHtml(metadata.description) : "";
  const split = splitTitleAndArtist(metadata.title ?? fallbackTitle, description || "Apple Music");

  return {
    provider: "apple_music",
    providerTrackId,
    url: url.toString(),
    title: split.title || fallbackTitle,
    artist: split.artist || "Apple Music",
    artworkUrl: metadata.image ?? undefined,
    karaokeCapable: true,
    playbackMode: "embedded",
  };
}

async function normalizeSoundCloudTrack(url: URL): Promise<KaraokeTrackLink> {
  const oEmbedUrl = new URL("https://soundcloud.com/oembed");
  oEmbedUrl.searchParams.set("format", "json");
  oEmbedUrl.searchParams.set("url", url.toString());

  const response = await fetch(oEmbedUrl.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SoundCloud metadata (${response.status})`);
  }

  const payload = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
    html?: string;
  };

  const providerTrackId = url.pathname.replace(/^\/+/, "") || url.toString();
  const title = payload.title?.trim() || inferTitleFromPath(url);
  const artist = payload.author_name?.trim() || "SoundCloud";

  return {
    provider: "soundcloud",
    providerTrackId,
    url: url.toString(),
    title,
    artist,
    artworkUrl: payload.thumbnail_url ?? undefined,
    karaokeCapable: true,
    playbackMode: "embedded",
  };
}

export async function normalizeKaraokeTrackUrl(rawUrl: string): Promise<KaraokeTrackLink> {
  const url = new URL(rawUrl);
  const provider = getProviderFromUrl(url);

  if (!provider || provider === "tts") {
    throw new Error("Unsupported karaoke provider URL");
  }

  if (provider === "spotify") {
    return normalizeSpotifyTrack(url);
  }

  if (provider === "apple_music") {
    return normalizeAppleMusicTrack(url);
  }

  return normalizeSoundCloudTrack(url);
}

export interface ProviderStatus {
  provider: Exclude<KaraokePlaybackProvider, "tts">;
  configured: boolean;
  connected: boolean;
  displayName: string;
  connectionId?: string;
  metadata?: Record<string, unknown>;
}

export function getBaseProviderStatuses(config: {
  soundcloudConfigured: boolean;
  appleMusicConfigured: boolean;
  spotifyConfigured: boolean;
}): ProviderStatus[] {
  return [
    {
      provider: "soundcloud",
      configured: config.soundcloudConfigured,
      connected: false,
      displayName: "SoundCloud",
    },
    {
      provider: "apple_music",
      configured: config.appleMusicConfigured,
      connected: false,
      displayName: "Apple Music",
    },
    {
      provider: "spotify",
      configured: config.spotifyConfigured,
      connected: false,
      displayName: "Spotify",
    },
  ];
}
