"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  ExternalLink,
  Loader2,
  Music4,
  Pause,
  Play,
  RefreshCw,
  Save,
  Trash2,
  Unlink,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  formatKaraokeProvider,
  getKaraokePolicyCopy,
  initializeAppleMusicClient,
  loadExternalScript,
  MusicKitInstance,
  SoundCloudWidget,
} from "@/lib/karaoke/client";
import { ProviderStatus } from "@/lib/karaoke/providers";
import {
  buildLyricCuesFromLines,
  findActiveLyricCueIndex,
  joinLyricsLines,
  splitLyricsTextToLines,
} from "@/lib/karaoke/timing";
import {
  KaraokeItemDetail,
  KaraokeLyrics,
  LyricCue,
} from "@/types/database";

interface KaraokeStudioProps {
  initialItem: KaraokeItemDetail;
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

function formatSeconds(ms: number) {
  return (ms / 1000).toFixed(2);
}

function getStatusTone(status: KaraokeItemDetail["status"]) {
  if (status === "ready") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "needs_timing") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
  if (status === "needs_lyrics") {
    return "border-rose-300/30 bg-rose-300/10 text-rose-100";
  }
  if (status === "error") {
    return "border-red-400/30 bg-red-400/10 text-red-100";
  }
  return "border-white/10 bg-white/[0.08] text-white/70";
}

function normalizeCueSequence(cues: LyricCue[]) {
  let nextStart = 0;

  return cues.map((cue) => {
    const startMs = Math.max(nextStart, cue.startMs);
    const endMs = Math.max(startMs + 250, cue.endMs);
    nextStart = endMs;

    return {
      ...cue,
      startMs,
      endMs,
    };
  });
}

function copyLyricsFromItem(item: KaraokeItemDetail) {
  return item.lyrics?.text ?? "";
}

function buildDraftCues(item: KaraokeItemDetail, lyricsText?: string) {
  if (item.primaryProvider === "spotify") {
    return [];
  }

  if (item.timeline?.cues?.length) {
    return item.timeline.cues.map((cue) => ({ ...cue }));
  }

  const text = lyricsText ?? copyLyricsFromItem(item);
  return buildLyricCuesFromLines(splitLyricsTextToLines(text));
}

export function KaraokeStudio({ initialItem }: KaraokeStudioProps) {
  const [item, setItem] = useState(initialItem);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [lyricsDraft, setLyricsDraft] = useState(copyLyricsFromItem(initialItem));
  const [draftCues, setDraftCues] = useState<LyricCue[]>(
    buildDraftCues(initialItem)
  );
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [providerPositionMs, setProviderPositionMs] = useState(0);
  const [providerPlaying, setProviderPlaying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingLyrics, setIsSavingLyrics] = useState(false);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);
  const [providerAction, setProviderAction] = useState<string | null>(null);
  const soundCloudIframeRef = useRef<HTMLIFrameElement | null>(null);
  const soundCloudWidgetRef = useRef<SoundCloudWidget | null>(null);
  const appleMusicRef = useRef<MusicKitInstance | null>(null);
  const applePollingRef = useRef<number | null>(null);

  const primaryProvider = item.primaryProvider;
  const policyCopy = getKaraokePolicyCopy(primaryProvider);
  const isSyncDisabled = primaryProvider === "spotify";
  const activeProviderStatus = useMemo(() => {
    return (
      providerStatuses.find((status) => status.provider === primaryProvider) ?? {
        provider: primaryProvider,
        configured: primaryProvider === "soundcloud",
        connected: primaryProvider === "soundcloud",
        displayName: formatKaraokeProvider(primaryProvider),
      }
    );
  }, [primaryProvider, providerStatuses]);
  const lyricsLines = useMemo(() => splitLyricsTextToLines(lyricsDraft), [lyricsDraft]);
  const displayedCues = useMemo(
    () => (isSyncDisabled ? [] : draftCues),
    [draftCues, isSyncDisabled]
  );
  const hasSavedTimeline = Boolean(item.timeline?.cues?.length);
  const activeTrack = item.track;

  const refreshProviderStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/karaoke/providers");
      if (!response.ok) {
        throw new Error("Failed to load provider state");
      }

      const payload = (await response.json()) as { providers?: ProviderStatus[] };
      setProviderStatuses(Array.isArray(payload.providers) ? payload.providers : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load provider state";
      toast.error(message);
    }
  }, []);

  const applyRemoteItem = useCallback((nextItem: KaraokeItemDetail) => {
    setItem(nextItem);
    const nextLyricsText = copyLyricsFromItem(nextItem);
    setLyricsDraft(nextLyricsText);
    setDraftCues(buildDraftCues(nextItem, nextLyricsText));
    setActiveCueIndex(0);
  }, []);

  const refreshItem = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/karaoke/items/${item.id}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to refresh karaoke item");
      }

      const payload = (await response.json()) as { item?: KaraokeItemDetail };
      if (!payload.item) {
        throw new Error("Karaoke item was not returned");
      }

      applyRemoteItem(payload.item);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to refresh karaoke item";
      toast.error(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [applyRemoteItem, item.id]);

  const connectAppleMusic = useCallback(async () => {
    setProviderAction("connect");
    try {
      const instance = await initializeAppleMusicClient();
      appleMusicRef.current = instance;
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

      await refreshProviderStatuses();
      toast.success("Apple Music connected");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect Apple Music";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [refreshProviderStatuses]);

  const connectSpotify = useCallback(async () => {
    setProviderAction("connect");
    try {
      const response = await fetch(
        `/api/karaoke/providers/spotify/start?returnTo=${encodeURIComponent(
          `/karaoke/${item.id}`
        )}`
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
  }, [item.id]);

  const disconnectProvider = useCallback(async () => {
    setProviderAction("disconnect");
    try {
      const response = await fetch(`/api/karaoke/providers/${primaryProvider}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to disconnect provider");
      }

      await refreshProviderStatuses();
      toast.success(`${formatKaraokeProvider(primaryProvider)} disconnected`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect provider";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [primaryProvider, refreshProviderStatuses]);

  const saveLyrics = useCallback(async () => {
    setIsSavingLyrics(true);
    try {
      const response = await fetch(`/api/karaoke/items/${item.id}/lyrics`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: lyricsDraft,
          source: "manual",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to save lyrics");
      }

      const payload = (await response.json()) as {
        lyrics?: KaraokeLyrics | null;
        status?: KaraokeItemDetail["status"];
      };

      const nextLyrics = payload.lyrics ?? null;
      setItem((current) => ({
        ...current,
        status: payload.status ?? current.status,
        lyrics: nextLyrics,
      }));

      if (!hasSavedTimeline) {
        const nextDraft = buildLyricCuesFromLines(
          nextLyrics?.lines ?? splitLyricsTextToLines(lyricsDraft)
        );
        setDraftCues(nextDraft);
      }

      toast.success("Lyrics saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save lyrics";
      toast.error(message);
    } finally {
      setIsSavingLyrics(false);
    }
  }, [hasSavedTimeline, item.id, lyricsDraft]);

  const regenerateTiming = useCallback(() => {
    const nextDraft = buildLyricCuesFromLines(lyricsLines);
    setDraftCues(nextDraft);
    setActiveCueIndex(0);
  }, [lyricsLines]);

  const saveTimeline = useCallback(async () => {
    if (isSyncDisabled) {
      return;
    }

    setIsSavingTimeline(true);
    try {
      const normalized = normalizeCueSequence(draftCues);
      const response = await fetch(`/api/karaoke/items/${item.id}/timeline`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: primaryProvider,
          cues: normalized,
          metadata: {
            source: hasSavedTimeline ? "manual_edit" : "generated_from_lyrics",
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to save timeline");
      }

      const payload = (await response.json()) as {
        timeline?: { cues: LyricCue[] } | null;
        status?: KaraokeItemDetail["status"];
      };

      setDraftCues(normalized);
      setItem((current) => ({
        ...current,
        status: payload.status ?? current.status,
        timeline: payload.timeline
          ? {
              ...(current.timeline ?? {
                id: "",
                user_id: "",
                karaoke_item_id: current.id,
                provider: current.primaryProvider,
                metadata: {},
                created_at: "",
                updated_at: "",
                cues: [],
              }),
              ...payload.timeline,
              provider: current.primaryProvider,
            }
          : current.timeline,
      }));
      toast.success("Timing saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save timing";
      toast.error(message);
    } finally {
      setIsSavingTimeline(false);
    }
  }, [draftCues, hasSavedTimeline, isSyncDisabled, item.id, primaryProvider]);

  const clearTimeline = useCallback(async () => {
    if (isSyncDisabled) {
      return;
    }

    setIsSavingTimeline(true);
    try {
      const response = await fetch(`/api/karaoke/items/${item.id}/timeline`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to clear timeline");
      }

      setItem((current) => ({
        ...current,
        status: current.lyrics?.lines?.length ? "needs_timing" : "needs_lyrics",
        timeline: null,
      }));
      setDraftCues(buildLyricCuesFromLines(lyricsLines));
      setActiveCueIndex(0);
      toast.success("Saved timing removed");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clear timing";
      toast.error(message);
    } finally {
      setIsSavingTimeline(false);
    }
  }, [isSyncDisabled, item.id, lyricsLines]);

  const deleteItem = useCallback(async () => {
    setProviderAction("delete");
    try {
      const response = await fetch(`/api/karaoke/items/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to delete karaoke item");
      }

      toast.success("Karaoke item deleted");
      window.location.assign("/karaoke");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete karaoke item";
      toast.error(message);
      setProviderAction(null);
    }
  }, [item.id]);

  const startApplePolling = useCallback(() => {
    if (applePollingRef.current) {
      window.clearInterval(applePollingRef.current);
      applePollingRef.current = null;
    }

    applePollingRef.current = window.setInterval(() => {
      const instance = appleMusicRef.current;
      if (!instance) return;

      const playbackTime = instance.player.currentPlaybackTime;
      if (typeof playbackTime === "number") {
        setProviderPositionMs(playbackTime * 1000);
      }
      setProviderPlaying(Boolean(instance.player.isPlaying));
    }, 300);
  }, []);

  const toggleApplePlayback = useCallback(async () => {
    if (!activeTrack) {
      toast.error("No Apple Music track is attached to this item.");
      return;
    }

    setProviderAction("apple-play");
    try {
      const instance = appleMusicRef.current ?? (await initializeAppleMusicClient());
      appleMusicRef.current = instance;

      if (!activeProviderStatus.connected) {
        await connectAppleMusic();
      }

      if (providerPlaying) {
        await instance.pause();
        setProviderPlaying(false);
      } else {
        await instance.setQueue({ url: activeTrack.url });
        await instance.play();
        setProviderPlaying(true);
      }

      startApplePolling();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to control Apple Music";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [
    activeProviderStatus.connected,
    activeTrack,
    connectAppleMusic,
    providerPlaying,
    startApplePolling,
  ]);

  const handleCueSeek = useCallback(
    async (index: number) => {
      setActiveCueIndex(index);
      const cue = displayedCues[index];
      if (!cue) {
        return;
      }

      if (primaryProvider === "soundcloud") {
        soundCloudWidgetRef.current?.seekTo(cue.startMs);
        setProviderPositionMs(cue.startMs);
        return;
      }

      if (primaryProvider === "apple_music") {
        const instance = appleMusicRef.current;
        if (!instance) {
          return;
        }
        await instance.player.seekToTime?.(cue.startMs / 1000);
        setProviderPositionMs(cue.startMs);
      }
    },
    [displayedCues, primaryProvider]
  );

  useEffect(() => {
    void refreshProviderStatuses();
    return () => {
      if (applePollingRef.current) {
        window.clearInterval(applePollingRef.current);
      }
    };
  }, [refreshProviderStatuses]);

  useEffect(() => {
    if (item.status !== "fetching_lyrics" || item.jobStatus !== "pending") {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshItem();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [item.jobStatus, item.status, refreshItem]);

  useEffect(() => {
    if (isSyncDisabled || displayedCues.length === 0) {
      return;
    }

    setActiveCueIndex(findActiveLyricCueIndex(displayedCues, providerPositionMs));
  }, [displayedCues, isSyncDisabled, providerPositionMs]);

  useEffect(() => {
    if (primaryProvider !== "soundcloud" || !activeTrack || !soundCloudIframeRef.current) {
      return;
    }

    let mounted = true;

    const setup = async () => {
      try {
        await loadExternalScript("https://w.soundcloud.com/player/api.js", "SC");
        const scWindow = window as unknown as {
          SC?: {
            Widget: ((iframe: HTMLIFrameElement) => SoundCloudWidget) & {
              Events: {
                READY: string;
                PLAY: string;
                PAUSE: string;
                PLAY_PROGRESS: string;
                SEEK: string;
              };
            };
          };
        };

        if (!mounted || !scWindow.SC?.Widget || !soundCloudIframeRef.current) {
          return;
        }

        const widget = scWindow.SC.Widget(soundCloudIframeRef.current);
        soundCloudWidgetRef.current = widget;

        widget.bind(scWindow.SC.Widget.Events.PLAY, () => {
          if (!mounted) return;
          setProviderPlaying(true);
        });
        widget.bind(scWindow.SC.Widget.Events.PAUSE, () => {
          if (!mounted) return;
          setProviderPlaying(false);
        });
        widget.bind(scWindow.SC.Widget.Events.PLAY_PROGRESS, (event) => {
          if (!mounted) return;
          setProviderPositionMs(event.currentPosition ?? 0);
        });
        widget.bind(scWindow.SC.Widget.Events.SEEK, (event) => {
          if (!mounted) return;
          setProviderPositionMs(event.currentPosition ?? 0);
        });
      } catch (error) {
        console.error("SoundCloud widget error:", error);
      }
    };

    void setup();

    return () => {
      mounted = false;
    };
  }, [activeTrack, primaryProvider]);

  return (
    <div className="flex h-full flex-col bg-[#070b0a] text-white">
      <div className="border-b border-white/[0.08] bg-black/20 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href="/karaoke">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">
                Karaoke Studio
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {item.title}
                </h1>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    getStatusTone(item.status)
                  )}
                >
                  {item.status.replaceAll("_", " ")}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/[0.65]">
                  {formatKaraokeProvider(primaryProvider)}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-white/[0.65]">{item.artist}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
              onClick={() => void refreshItem()}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
              onClick={() => void deleteItem()}
              disabled={providerAction === "delete"}
            >
              {providerAction === "delete" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)_380px] xl:p-5">
        <aside className="flex min-h-0 flex-col gap-4">
          <div className="rounded-[24px] border border-white/[0.08] bg-[#0d1412] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
            <div className="flex items-start gap-4">
              {item.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.artworkUrl}
                  alt=""
                  className="h-24 w-24 rounded-[20px] object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/[0.03]">
                  <Music4 className="size-8 text-white/50" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-medium">{item.title}</p>
                <p className="mt-1 truncate text-sm text-white/60">{item.artist}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
                  <span className="rounded-full border border-white/10 px-2.5 py-1">
                    {formatDuration(item.durationMs)}
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1">
                    {lyricsLines.length} lines
                  </span>
                </div>
              </div>
            </div>

            {policyCopy && (
              <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-200">
                {policyCopy}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {activeTrack?.url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <a href={activeTrack.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    Open Track
                  </a>
                </Button>
              )}
              {primaryProvider === "apple_music" &&
                !activeProviderStatus.connected &&
                activeProviderStatus.configured && (
                  <Button
                    size="sm"
                    className="bg-emerald-400 text-black hover:bg-emerald-300"
                    disabled={providerAction === "connect"}
                    onClick={() => void connectAppleMusic()}
                  >
                    {providerAction === "connect" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Music4 className="size-4" />
                    )}
                    Connect Apple Music
                  </Button>
                )}
              {primaryProvider === "spotify" &&
                !activeProviderStatus.connected &&
                activeProviderStatus.configured && (
                  <Button
                    size="sm"
                    className="bg-emerald-400 text-black hover:bg-emerald-300"
                    disabled={providerAction === "connect"}
                    onClick={() => void connectSpotify()}
                  >
                    {providerAction === "connect" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Music4 className="size-4" />
                    )}
                    Connect Spotify
                  </Button>
                )}
              {primaryProvider !== "soundcloud" && activeProviderStatus.connected && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                  disabled={providerAction === "disconnect"}
                  onClick={() => void disconnectProvider()}
                >
                  {providerAction === "disconnect" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Unlink className="size-4" />
                  )}
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.08] bg-[#0d1412] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
              Playback
            </p>
            <div className="mt-3 space-y-3">
              {primaryProvider === "soundcloud" && activeTrack && (
                <>
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
                    <iframe
                      ref={soundCloudIframeRef}
                      title="SoundCloud karaoke player"
                      width="100%"
                      height="166"
                      scrolling="no"
                      allow="autoplay"
                      src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
                        activeTrack.url
                      )}&auto_play=false&show_artwork=true&show_user=true`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-400 text-black hover:bg-emerald-300"
                      onClick={() => {
                        if (providerPlaying) {
                          soundCloudWidgetRef.current?.pause();
                        } else {
                          soundCloudWidgetRef.current?.play();
                        }
                      }}
                    >
                      {providerPlaying ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      {providerPlaying ? "Pause" : "Play"}
                    </Button>
                  </div>
                </>
              )}

              {primaryProvider === "apple_music" && activeTrack && (
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <p className="text-sm text-white/70">
                    Queue the Apple Music track in-browser and use your lyric cues as the visual timing source.
                  </p>
                  <Button
                    className="mt-4 w-full bg-emerald-400 text-black hover:bg-emerald-300"
                    disabled={providerAction === "apple-play"}
                    onClick={() => void toggleApplePlayback()}
                  >
                    {providerAction === "apple-play" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : providerPlaying ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {providerPlaying ? "Pause Apple Music" : "Play Apple Music"}
                  </Button>
                </div>
              )}

              {primaryProvider === "spotify" && (
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <p className="text-sm text-white/70">
                    Spotify playback stays outside the app. Keep lyrics and notes here, then open the track in Spotify.
                  </p>
                  {activeTrack?.url && (
                    <Button
                      className="mt-4 w-full bg-emerald-400 text-black hover:bg-emerald-300"
                      asChild
                    >
                      <a href={activeTrack.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                        Open in Spotify
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {!activeTrack && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  This item has no active provider track.
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="min-h-0 rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.12),transparent_32%),#08100e] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Live Lyrics
                </p>
                <p className="mt-1 text-sm text-white/60">
                  {isSyncDisabled
                    ? "Spotify items keep editable lyrics here without synced highlighting."
                    : displayedCues.length > 0
                      ? "Click a line to jump playback or rehearse timing."
                      : "Add lyrics first, then generate or save timing cues."}
                </p>
              </div>
              {!isSyncDisabled && displayedCues.length > 0 && (
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/[0.65]">
                  Cue {Math.min(activeCueIndex + 1, displayedCues.length)} / {displayedCues.length}
                </div>
              )}
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              {lyricsLines.length === 0 ? (
                <div className="flex h-full min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-white/60">
                  No lyrics saved yet. Paste them in the editor to the right, or let the lyrics worker import them when a provider result is available.
                </div>
              ) : (
                <div className="space-y-2">
                  {lyricsLines.map((line, index) => {
                    const cue = displayedCues[index];
                    const isActive = !isSyncDisabled && index === activeCueIndex;

                    return (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => void handleCueSeek(index)}
                        className={cn(
                          "flex w-full flex-col rounded-[24px] border px-4 py-4 text-left transition-all",
                          isActive
                            ? "border-emerald-300/35 bg-emerald-300/10 shadow-[0_0_0_1px_rgba(110,231,183,0.12)]"
                            : "border-white/[0.08] bg-black/20 hover:border-white/[0.14] hover:bg-white/[0.03]",
                          isSyncDisabled && "cursor-default"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p
                            className={cn(
                              "text-lg leading-8 text-white/70 md:text-[1.15rem]",
                              isActive && "text-white"
                            )}
                          >
                            {line.text}
                          </p>
                          {!isSyncDisabled && cue && (
                            <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/[0.55]">
                              {formatSeconds(cue.startMs)}s
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="min-h-0 rounded-[24px] border border-white/[0.08] bg-[#0d1412] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <Tabs defaultValue="lyrics" className="flex h-full min-h-0 flex-col">
            <TabsList className="grid w-full grid-cols-2 bg-black/30">
              <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
              <TabsTrigger value="timing">Timing</TabsTrigger>
            </TabsList>

            <TabsContent value="lyrics" className="mt-4 flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Lyric Source</p>
                  <p className="text-xs text-white/60">
                    Keep lyrics separate from reading content and edit them here.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                  {item.lyrics?.source ?? "manual"}
                </span>
              </div>
              <textarea
                value={lyricsDraft}
                onChange={(event) => setLyricsDraft(event.target.value)}
                placeholder="Paste song lyrics here..."
                className="mt-4 min-h-[320px] flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/30 focus:border-emerald-300/35"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  className="bg-emerald-400 text-black hover:bg-emerald-300"
                  disabled={isSavingLyrics}
                  onClick={() => void saveLyrics()}
                >
                  {isSavingLyrics ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save Lyrics
                </Button>
                <Button
                  variant="ghost"
                  className="border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setLyricsDraft(joinLyricsLines(item.lyrics?.lines ?? []))}
                >
                  Reset to Saved
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="timing" className="mt-4 flex min-h-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Timing Editor</p>
                  <p className="text-xs text-white/60">
                    Generate cues from lines, then tune start and end times per line.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                  {hasSavedTimeline ? "Saved timing" : "Draft timing"}
                </span>
              </div>

              {isSyncDisabled ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4 text-sm text-amber-200">
                  Spotify items do not support synced karaoke visuals here. Keep lyrics editable, then play the song in Spotify itself.
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      className="bg-emerald-400 text-black hover:bg-emerald-300"
                      onClick={regenerateTiming}
                    >
                      <WandSparkles className="size-4" />
                      Regenerate from Lyrics
                    </Button>
                    <Button
                      variant="ghost"
                      className="border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                      disabled={isSavingTimeline || draftCues.length === 0}
                      onClick={() => void saveTimeline()}
                    >
                      {isSavingTimeline ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save Timing
                    </Button>
                    <Button
                      variant="ghost"
                      className="border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                      disabled={isSavingTimeline || !hasSavedTimeline}
                      onClick={() => void clearTimeline()}
                    >
                      Clear Saved Timing
                    </Button>
                  </div>

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/[0.08] bg-black/20">
                    {draftCues.length === 0 ? (
                      <div className="p-4 text-sm text-white/60">
                        Add lyrics first, then generate cue timings.
                      </div>
                    ) : (
                      <div className="divide-y divide-white/8">
                        {draftCues.map((cue, index) => (
                          <div key={`${cue.startOffset}-${cue.endOffset}-${index}`} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-sm text-white/80">{cue.text}</p>
                              </div>
                              {index === activeCueIndex && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] text-emerald-200">
                                  <Check className="size-3.5" />
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <label className="space-y-1 text-xs text-white/60">
                                <span>Start (seconds)</span>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  value={formatSeconds(cue.startMs)}
                                  onChange={(event) => {
                                    const nextValue = Number(event.target.value);
                                    if (!Number.isFinite(nextValue) || nextValue < 0) {
                                      return;
                                    }
                                    setDraftCues((current) =>
                                      current.map((currentCue, currentIndex) =>
                                        currentIndex === index
                                          ? {
                                              ...currentCue,
                                              startMs: Math.round(nextValue * 1000),
                                            }
                                          : currentCue
                                      )
                                    );
                                  }}
                                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/35"
                                />
                              </label>
                              <label className="space-y-1 text-xs text-white/60">
                                <span>End (seconds)</span>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  value={formatSeconds(cue.endMs)}
                                  onChange={(event) => {
                                    const nextValue = Number(event.target.value);
                                    if (!Number.isFinite(nextValue) || nextValue < 0) {
                                      return;
                                    }
                                    setDraftCues((current) =>
                                      current.map((currentCue, currentIndex) =>
                                        currentIndex === index
                                          ? {
                                              ...currentCue,
                                              endMs: Math.round(nextValue * 1000),
                                            }
                                          : currentCue
                                      )
                                    );
                                  }}
                                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/35"
                                />
                              </label>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                                onClick={() => void handleCueSeek(index)}
                              >
                                <Clock3 className="size-4" />
                                Jump to Cue
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
