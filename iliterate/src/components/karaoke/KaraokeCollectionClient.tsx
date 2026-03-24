"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  Library,
  Link2,
  Loader2,
  Music4,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatKaraokeProvider,
  getKaraokePolicyCopy,
  initializeAppleMusicClient,
} from "@/lib/karaoke/client";
import { ProviderStatus } from "@/lib/karaoke/providers";
import {
  KaraokeItemSummary,
  KaraokeMusicProvider,
  KaraokeTrackLink,
} from "@/types/database";

interface KaraokeCollectionClientProps {
  initialItems: KaraokeItemSummary[];
}

const PROVIDERS: KaraokeMusicProvider[] = [
  "soundcloud",
  "apple_music",
  "spotify",
];

const STATUS_COPY: Record<KaraokeItemSummary["status"], string> = {
  fetching_lyrics: "Fetching lyrics",
  needs_lyrics: "Needs lyrics",
  needs_timing: "Needs timing",
  ready: "Ready",
  error: "Error",
};

function formatRelativeDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) {
    return "Unknown length";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getStatusTone(status: KaraokeItemSummary["status"]) {
  if (status === "ready") {
    return "border-emerald-400/30 bg-emerald-400/12 text-emerald-100";
  }
  if (status === "needs_timing") {
    return "border-amber-300/30 bg-amber-300/12 text-amber-100";
  }
  if (status === "needs_lyrics") {
    return "border-rose-300/30 bg-rose-300/12 text-rose-100";
  }
  if (status === "error") {
    return "border-red-400/30 bg-red-400/12 text-red-100";
  }
  return "border-white/10 bg-white/[0.08] text-white/70";
}

export function KaraokeCollectionClient({
  initialItems,
}: KaraokeCollectionClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [activeProvider, setActiveProvider] =
    useState<KaraokeMusicProvider>("soundcloud");
  const [searchQuery, setSearchQuery] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [tracks, setTracks] = useState<KaraokeTrackLink[]>([]);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [providerAction, setProviderAction] = useState<string | null>(null);
  const [creatingTrackId, setCreatingTrackId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const readyCount = useMemo(
    () => items.filter((item) => item.status === "ready").length,
    [items]
  );
  const draftCount = useMemo(
    () =>
      items.filter(
        (item) => item.status === "needs_lyrics" || item.status === "needs_timing"
      ).length,
    [items]
  );

  const loadProviderStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/karaoke/providers");
      if (!response.ok) {
        throw new Error("Failed to load provider connections");
      }

      const payload = (await response.json()) as { providers?: ProviderStatus[] };
      setProviderStatuses(Array.isArray(payload.providers) ? payload.providers : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load provider connections";
      toast.error(message);
    }
  }, []);

  const loadTracks = useCallback(
    async (provider: KaraokeMusicProvider, query?: string) => {
      setIsTrackLoading(true);
      try {
        const endpoint = query?.trim()
          ? `/api/karaoke/providers/${provider}/search?q=${encodeURIComponent(
              query.trim()
            )}`
          : `/api/karaoke/providers/${provider}/browse`;
        const response = await fetch(endpoint);
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || "Failed to load provider tracks");
        }

        const payload = (await response.json()) as { tracks?: KaraokeTrackLink[] };
        setTracks(Array.isArray(payload.tracks) ? payload.tracks : []);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load provider tracks";
        toast.error(message);
        setTracks([]);
      } finally {
        setIsTrackLoading(false);
      }
    },
    []
  );

  const createItem = useCallback(
    async (payload: { track?: KaraokeTrackLink; url?: string }, loadingKey: string) => {
      setCreatingTrackId(loadingKey);
      try {
        const response = await fetch("/api/karaoke/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const result = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(result.error || "Failed to create karaoke item");
        }

        const result = (await response.json()) as {
          item?: KaraokeItemSummary | null;
        };

        if (!result.item) {
          throw new Error("Karaoke item creation returned no item");
        }

        setItems((current) => [result.item as KaraokeItemSummary, ...current]);
        toast.success("Added to karaoke collection");
        router.push(`/karaoke/${result.item.id}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create karaoke item";
        toast.error(message);
      } finally {
        setCreatingTrackId(null);
      }
    },
    [router]
  );

  const connectAppleMusic = useCallback(async () => {
    setProviderAction("connect");
    try {
      const instance = await initializeAppleMusicClient();
      const musicUserToken = await instance.authorize();
      const response = await fetch("/api/karaoke/providers/apple_music/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ musicUserToken }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to connect Apple Music");
      }

      await loadProviderStatuses();
      await loadTracks("apple_music");
      toast.success("Apple Music connected");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect Apple Music";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [loadProviderStatuses, loadTracks]);

  const connectSpotify = useCallback(async () => {
    setProviderAction("connect");
    try {
      const response = await fetch(
        "/api/karaoke/providers/spotify/start?returnTo=%2Fkaraoke"
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to connect Spotify");
      }

      const payload = (await response.json()) as { authorizeUrl: string };
      window.location.assign(payload.authorizeUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect Spotify";
      toast.error(message);
      setProviderAction(null);
    }
  }, []);

  const disconnectProvider = useCallback(async (provider: KaraokeMusicProvider) => {
    setProviderAction("disconnect");
    try {
      const response = await fetch(`/api/karaoke/providers/${provider}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to disconnect provider");
      }

      await loadProviderStatuses();
      toast.success(`${formatKaraokeProvider(provider)} disconnected`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect provider";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [loadProviderStatuses]);

  const deleteItem = useCallback(async (itemId: string) => {
    setDeletingItemId(itemId);
    try {
      const response = await fetch(`/api/karaoke/items/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to delete karaoke item");
      }

      setItems((current) => current.filter((item) => item.id !== itemId));
      toast.success("Removed from karaoke collection");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete karaoke item";
      toast.error(message);
    } finally {
      setDeletingItemId(null);
    }
  }, []);

  useEffect(() => {
    void loadProviderStatuses();
  }, [loadProviderStatuses]);

  useEffect(() => {
    void loadTracks(activeProvider, searchQuery.trim() ? searchQuery : undefined);
  }, [activeProvider, loadTracks, searchQuery]);

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[28px] border border-emerald-400/15 bg-[#07110f] text-white shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(253,186,116,0.1),transparent_28%)]" />
        <div className="relative grid gap-8 p-6 md:grid-cols-[1.4fr_0.9fr] md:p-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100/80">
              <Sparkles className="size-3.5" />
              Dedicated Karaoke
            </div>
            <div className="space-y-3">
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Build a personal setlist, then rehearse each song in a real lyric studio.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-white/70 md:text-base">
                Import from SoundCloud, Apple Music, or Spotify. Lyrics live here,
                timing lives here, and the reader stays focused on reading.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">
                  Collection
                </p>
                <p className="mt-2 text-3xl font-semibold">{items.length}</p>
                <p className="mt-1 text-sm text-white/60">Songs in your queue</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">
                  Stage Ready
                </p>
                <p className="mt-2 text-3xl font-semibold">{readyCount}</p>
                <p className="mt-1 text-sm text-white/60">Items with synced lyrics ready</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">
                  In Progress
                </p>
                <p className="mt-2 text-3xl font-semibold">{draftCount}</p>
                <p className="mt-1 text-sm text-white/60">Songs waiting for lyrics or timing</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/[0.45]">
                  Connections
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Manage provider auth before import.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => void loadProviderStatuses()}
                title="Refresh provider state"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {PROVIDERS.map((provider) => {
                const status =
                  providerStatuses.find((entry) => entry.provider === provider) ?? {
                    provider,
                    configured: provider === "soundcloud",
                    connected: provider === "soundcloud",
                    displayName: formatKaraokeProvider(provider),
                  };

                return (
                  <div
                    key={provider}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {formatKaraokeProvider(provider)}
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          {provider === "soundcloud"
                            ? "Public-track import works without account auth."
                            : status.connected
                              ? "Connected and ready for import."
                              : status.configured
                                ? "Sign in to browse and import faster."
                                : "This provider is not configured in the current env."}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          status.connected
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                            : "border-white/10 bg-white/5 text-white/[0.65]"
                        )}
                      >
                        {status.connected ? "Connected" : "Offline"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {provider === "apple_music" && !status.connected && status.configured && (
                        <Button
                          size="sm"
                          className="bg-emerald-400 text-black hover:bg-emerald-300"
                          disabled={providerAction === "connect"}
                          onClick={() => void connectAppleMusic()}
                        >
                          {providerAction === "connect" && activeProvider === "apple_music" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Music4 className="size-4" />
                          )}
                          Connect Apple Music
                        </Button>
                      )}
                      {provider === "spotify" && !status.connected && status.configured && (
                        <Button
                          size="sm"
                          className="bg-emerald-400 text-black hover:bg-emerald-300"
                          disabled={providerAction === "connect"}
                          onClick={() => void connectSpotify()}
                        >
                          {providerAction === "connect" && activeProvider === "spotify" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Music4 className="size-4" />
                          )}
                          Connect Spotify
                        </Button>
                      )}
                      {provider !== "soundcloud" && status.connected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="border border-white/12 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                          disabled={providerAction === "disconnect"}
                          onClick={() => void disconnectProvider(provider)}
                        >
                          {providerAction === "disconnect" && activeProvider === provider ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Unlink className="size-4" />
                          )}
                          Disconnect
                        </Button>
                      )}
                      {provider === "soundcloud" && (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/[0.65]">
                          URL import available
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-border bg-card/70 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Import Tracks
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Start from a provider, then open the lyric studio.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setActiveProvider(provider)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    activeProvider === provider
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {formatKaraokeProvider(provider)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-emerald-400/15 bg-[#0b1513] p-4 text-white">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={`Search ${formatKaraokeProvider(activeProvider)} by title or artist`}
                  className="border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-white/[0.35]"
                />
              </div>
              <Button
                variant="secondary"
                className="bg-white text-black hover:bg-white/90"
                onClick={() =>
                  void loadTracks(
                    activeProvider,
                    searchQuery.trim() ? searchQuery.trim() : undefined
                  )
                }
                disabled={isTrackLoading}
              >
                {isTrackLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {searchQuery.trim() ? "Search" : "Browse"}
              </Button>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder={`Paste a ${formatKaraokeProvider(activeProvider)} track URL`}
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/[0.35]"
              />
              <Button
                className="bg-emerald-400 text-black hover:bg-emerald-300"
                onClick={() =>
                  void createItem({ url: urlInput.trim() }, `url:${activeProvider}`)
                }
                disabled={!urlInput.trim() || creatingTrackId === `url:${activeProvider}`}
              >
                {creatingTrackId === `url:${activeProvider}` ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                Import via URL
              </Button>
            </div>
            <p className="mt-3 text-xs text-white/60">
              {activeProvider === "soundcloud"
                ? "SoundCloud search is seeded from your recent imports. Public URL fallback always works."
                : "Search results come from the provider when available. URL fallback is always enabled."}
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {isTrackLoading && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Loading tracks from {formatKaraokeProvider(activeProvider)}...
              </div>
            )}

            {!isTrackLoading && tracks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No tracks surfaced yet. Try a different query or paste a direct URL.
              </div>
            )}

            {tracks.map((track) => (
              <div
                key={`${track.provider}-${track.providerTrackId}`}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-background/70 p-4 md:flex-row md:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  {track.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={track.artworkUrl}
                      alt=""
                      className="size-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
                      <Music4 className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{track.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                        <Clock3 className="size-3.5" />
                        {formatDuration(track.durationMs)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                        {formatKaraokeProvider(track.provider)}
                      </span>
                      {track.karaokeCapable ? (
                        <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                          Embedded playback
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-1 text-amber-700 dark:text-amber-300">
                          Link-out only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={track.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="size-4" />
                      Open
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-400 text-black hover:bg-emerald-300"
                    onClick={() =>
                      void createItem(
                        { track },
                        `${track.provider}:${track.providerTrackId}`
                      )
                    }
                    disabled={
                      creatingTrackId === `${track.provider}:${track.providerTrackId}`
                    }
                  >
                    {creatingTrackId === `${track.provider}:${track.providerTrackId}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    Add to Karaoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-card/70 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Your Setlist
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Songs you can rehearse, retime, and refine.
              </h2>
            </div>
            <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              {items.length} total
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                Import a song to create your first karaoke item. Lyrics and timing will be managed independently from the reading library.
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-border bg-background/70 p-4"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    {item.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.artworkUrl}
                        alt=""
                        className="h-[4.5rem] w-[4.5rem] rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
                        <Library className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-medium">{item.title}</p>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                            getStatusTone(item.status)
                          )}
                        >
                          {STATUS_COPY[item.status]}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.artist}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1">
                          {formatKaraokeProvider(item.primaryProvider)}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1">
                          {item.lineCount} lyric lines
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1">
                          Saved {formatRelativeDate(item.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {item.primaryProvider === activeProvider &&
                    getKaraokePolicyCopy(item.primaryProvider) && (
                      <p className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        {getKaraokePolicyCopy(item.primaryProvider)}
                      </p>
                    )}

                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="bg-emerald-400 text-black hover:bg-emerald-300">
                      <Link href={`/karaoke/${item.id}`}>
                        Open Studio
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    {item.track?.url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={item.track.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                          Open Track
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void deleteItem(item.id)}
                      disabled={deletingItemId === item.id}
                    >
                      {deletingItemId === item.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {getKaraokePolicyCopy(activeProvider) && (
        <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm text-amber-800 dark:text-amber-200">
          {getKaraokePolicyCopy(activeProvider)}
        </section>
      )}
    </div>
  );
}
