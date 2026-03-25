"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Music4,
  Pause,
  Play,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Unlink,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  getKaraokeTimingStatus,
  joinLyricsLines,
  splitLyricsTextToLines,
} from "@/lib/karaoke/timing";
import {
  KaraokeItemDetail,
  KaraokeItemTimingStatus,
  KaraokeLyrics,
  KaraokeSetlist,
  LyricCue,
} from "@/types/database";

interface KaraokeStudioProps {
  initialItem: KaraokeItemDetail;
}

const STATUS_COPY: Record<KaraokeItemDetail["status"], string> = {
  matching: "Matching lyrics",
  ready: "Ready",
  needs_review: "Needs review",
  manual_fallback: "Needs manual lyrics",
  error: "Error",
};

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
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "needs_review") {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }
  if (status === "manual_fallback") {
    return "border-rose-300/25 bg-rose-300/10 text-rose-100";
  }
  if (status === "error") {
    return "border-red-400/25 bg-red-400/10 text-red-100";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [item, setItem] = useState(initialItem);
  const [setlists, setSetlists] = useState<KaraokeSetlist[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [lyricsDraft, setLyricsDraft] = useState(copyLyricsFromItem(initialItem));
  const [draftCues, setDraftCues] = useState<LyricCue[]>(buildDraftCues(initialItem));
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [providerPositionMs, setProviderPositionMs] = useState(0);
  const [providerPlaying, setProviderPlaying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingLyrics, setIsSavingLyrics] = useState(false);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);
  const [providerAction, setProviderAction] = useState<string | null>(null);
  const [lyricsPanelOpen, setLyricsPanelOpen] = useState(
    initialItem.status === "manual_fallback" || !copyLyricsFromItem(initialItem).trim()
  );
  const [timingPanelOpen, setTimingPanelOpen] = useState(
    initialItem.status === "needs_review" && initialItem.primaryProvider !== "spotify"
  );
  const soundCloudIframeRef = useRef<HTMLIFrameElement | null>(null);
  const soundCloudWidgetRef = useRef<SoundCloudWidget | null>(null);
  const appleMusicRef = useRef<MusicKitInstance | null>(null);
  const applePollingRef = useRef<number | null>(null);

  const primaryProvider = item.primaryProvider;
  const policyCopy = getKaraokePolicyCopy(primaryProvider);
  const isSyncDisabled = primaryProvider === "spotify";
  const activeTrack = item.track;

  const activeProviderStatus = useMemo(() => {
    return (
      providerStatuses.find((status) => status.provider === primaryProvider) ?? {
        provider: primaryProvider,
        configured: false,
        connected: false,
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

  const activeSetlistId = searchParams.get("setlist");
  const activeSetlist = useMemo(() => {
    if (activeSetlistId) {
      const fromQuery = setlists.find((setlist) => setlist.id === activeSetlistId);
      if (fromQuery) {
        return fromQuery;
      }
    }

    return (
      setlists.find((setlist) =>
        setlist.items.some((setlistItem) => setlistItem.karaokeItemId === item.id)
      ) ??
      setlists.find((setlist) => setlist.isDefault) ??
      setlists[0] ??
      null
    );
  }, [activeSetlistId, item.id, setlists]);

  const queueIndex = useMemo(() => {
    return (
      activeSetlist?.items.findIndex((setlistItem) => setlistItem.karaokeItemId === item.id) ??
      -1
    );
  }, [activeSetlist, item.id]);

  const previousQueueItem =
    queueIndex > 0 ? activeSetlist?.items[queueIndex - 1]?.item ?? null : null;
  const nextQueueItem =
    queueIndex >= 0 && activeSetlist && queueIndex < activeSetlist.items.length - 1
      ? activeSetlist.items[queueIndex + 1]?.item ?? null
      : null;

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

  const refreshSetlists = useCallback(async () => {
    try {
      const response = await fetch("/api/karaoke/setlists");
      if (!response.ok) {
        throw new Error("Failed to load karaoke setlists");
      }

      const payload = (await response.json()) as { setlists?: KaraokeSetlist[] };
      setSetlists(Array.isArray(payload.setlists) ? payload.setlists : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load karaoke setlists";
      toast.error(message);
    }
  }, []);

  const applyRemoteItem = useCallback((nextItem: KaraokeItemDetail) => {
    setItem(nextItem);
    const nextLyricsText = copyLyricsFromItem(nextItem);
    setLyricsDraft(nextLyricsText);
    setDraftCues(buildDraftCues(nextItem, nextLyricsText));
    setActiveCueIndex(0);
    if (nextItem.status === "manual_fallback" && !nextLyricsText.trim()) {
      setLyricsPanelOpen(true);
    }
    if (nextItem.status === "needs_review" && nextItem.primaryProvider !== "spotify") {
      setTimingPanelOpen(true);
    }
  }, []);

  const refreshItem = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/karaoke/items/${item.id}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
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
    setProviderAction("apple-connect");
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
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

  const startProviderOAuth = useCallback(async (provider: "spotify" | "soundcloud") => {
    setProviderAction(`${provider}-connect`);
    try {
      const response = await fetch(
        `/api/karaoke/providers/${provider}/start?returnTo=${encodeURIComponent(
          `/karaoke/${item.id}${activeSetlist ? `?setlist=${activeSetlist.id}` : ""}`
        )}`
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `Failed to connect ${provider}`);
      }

      const payload = (await response.json()) as { authorizeUrl: string };
      window.location.assign(payload.authorizeUrl);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to connect ${formatKaraokeProvider(provider)}`;
      toast.error(message);
      setProviderAction(null);
    }
  }, [activeSetlist, item.id]);

  const disconnectProvider = useCallback(async () => {
    setProviderAction("disconnect");
    try {
      const response = await fetch(`/api/karaoke/providers/${primaryProvider}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to save lyrics");
      }

      const payload = (await response.json()) as {
        lyrics?: KaraokeLyrics | null;
        status?: KaraokeItemDetail["status"];
        lyricsStatus?: KaraokeItemDetail["lyricsStatus"];
        timingStatus?: KaraokeItemDetail["timingStatus"];
      };

      const nextLyrics = payload.lyrics ?? null;
      setItem((current) => ({
        ...current,
        status: payload.status ?? current.status,
        lyricsStatus: payload.lyricsStatus ?? current.lyricsStatus,
        timingStatus: payload.timingStatus ?? current.timingStatus,
        lyrics: nextLyrics,
      }));

      if (!hasSavedTimeline) {
        setDraftCues(
          buildLyricCuesFromLines(
            nextLyrics?.lines ?? splitLyricsTextToLines(lyricsDraft)
          )
        );
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to save timing");
      }

      const payload = (await response.json()) as {
        timeline?: { cues: LyricCue[] } | null;
        status?: KaraokeItemDetail["status"];
        lyricsStatus?: KaraokeItemDetail["lyricsStatus"];
        timingStatus?: KaraokeItemTimingStatus;
      };

      setDraftCues(normalized);
      setItem((current) => ({
        ...current,
        status: payload.status ?? current.status,
        lyricsStatus: payload.lyricsStatus ?? current.lyricsStatus,
        timingStatus: payload.timingStatus ?? current.timingStatus,
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to clear timing");
      }

      setItem((current) => ({
        ...current,
        status: current.lyricsStatus === "ready" ? "needs_review" : current.status,
        timingStatus: getKaraokeTimingStatus(current.primaryProvider, false),
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
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

  const toggleSoundCloudPlayback = useCallback(() => {
    if (providerPlaying) {
      soundCloudWidgetRef.current?.pause();
    } else {
      soundCloudWidgetRef.current?.play();
    }
  }, [providerPlaying]);

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

  const updateCue = useCallback(
    (index: number, field: "startMs" | "endMs", value: string) => {
      const parsed = Number.parseFloat(value);
      if (Number.isNaN(parsed)) {
        return;
      }

      setDraftCues((current) =>
        current.map((cue, cueIndex) =>
          cueIndex === index ? { ...cue, [field]: Math.max(parsed * 1000, 0) } : cue
        )
      );
    },
    []
  );

  useEffect(() => {
    void Promise.all([refreshProviderStatuses(), refreshSetlists()]);
    return () => {
      if (applePollingRef.current) {
        window.clearInterval(applePollingRef.current);
      }
    };
  }, [refreshProviderStatuses, refreshSetlists]);

  useEffect(() => {
    if (item.status !== "matching" || item.jobStatus !== "pending") {
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
    <div className="flex h-full min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(21,128,61,0.14),_transparent_30%),#050807] text-white">
      <div className="border-b border-white/8 bg-black/25 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 md:px-6">
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
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Karaoke Studio
                </div>
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
                    {STATUS_COPY[item.status]}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                    {formatKaraokeProvider(primaryProvider)}
                  </span>
                  {activeSetlist && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                      {activeSetlist.name}
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-sm text-white/60">{item.artist}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
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
      </div>

      <div className="mx-auto grid h-full w-full max-w-[1600px] gap-6 px-4 py-5 md:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex min-h-0 flex-col gap-5">
          <section className="rounded-[28px] border border-white/10 bg-black/25 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex min-w-0 gap-4">
                <div className="size-24 shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]">
                  {item.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.artworkUrl}
                      alt={`${item.title} artwork`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-white/35">
                      <Music4 className="size-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-3">
                  <div className="space-y-1">
                    <div className="truncate text-xl font-semibold text-white">{item.title}</div>
                    <div className="truncate text-sm text-white/55">{item.artist}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-white/55">
                    <span className="rounded-full border border-white/10 px-2.5 py-1">
                      {formatDuration(item.durationMs)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1">
                      {lyricsLines.length} lines
                    </span>
                    {item.matchConfidence !== undefined && (
                      <span className="rounded-full border border-white/10 px-2.5 py-1">
                        Match {Math.round(item.matchConfidence * 100)}%
                      </span>
                    )}
                  </div>
                  {policyCopy && (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2 text-xs leading-5 text-amber-200">
                      {policyCopy}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                {previousQueueItem && activeSetlist && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                    onClick={() =>
                      router.push(`/karaoke/${previousQueueItem.id}?setlist=${activeSetlist.id}`)
                    }
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </Button>
                )}
                {nextQueueItem && activeSetlist && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                    onClick={() =>
                      router.push(`/karaoke/${nextQueueItem.id}?setlist=${activeSetlist.id}`)
                    }
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                )}
                {activeTrack?.url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                    asChild
                  >
                    <a href={activeTrack.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Open Source
                    </a>
                  </Button>
                )}
                {(primaryProvider === "apple_music" || primaryProvider === "soundcloud" || primaryProvider === "spotify") &&
                  !activeProviderStatus.connected && activeProviderStatus.configured && (
                    <Button
                      size="sm"
                      onClick={() =>
                        primaryProvider === "apple_music"
                          ? void connectAppleMusic()
                          : void startProviderOAuth(primaryProvider)
                      }
                    >
                      {providerAction === `${primaryProvider}-connect` ||
                      providerAction === "apple-connect" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Music4 className="size-4" />
                      )}
                      Connect {formatKaraokeProvider(primaryProvider)}
                    </Button>
                  )}
                {activeProviderStatus.connected && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => void disconnectProvider()}
                    disabled={providerAction === "disconnect"}
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

            <div className="mt-4 rounded-[24px] border border-white/8 bg-[#07100d] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Playback
                  </div>
                  <div className="mt-1 text-sm text-white/60">
                    Keep rehearsal front and center. Fix lyrics and sync only when you need to.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {primaryProvider === "soundcloud" && activeTrack && (
                    <Button
                      className="bg-emerald-400 text-black hover:bg-emerald-300"
                      onClick={() => toggleSoundCloudPlayback()}
                    >
                      {providerPlaying ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      {providerPlaying ? "Pause" : "Play"}
                    </Button>
                  )}
                  {primaryProvider === "apple_music" && activeTrack && (
                    <Button
                      className="bg-emerald-400 text-black hover:bg-emerald-300"
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
                      {providerPlaying ? "Pause" : "Play"}
                    </Button>
                  )}
                </div>
              </div>

              {primaryProvider === "soundcloud" && activeTrack && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-black/20">
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
              )}

              {primaryProvider === "spotify" && (
                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/60">
                  Spotify stays as metadata plus link-out playback here. Lyrics remain editable, but synced cue-following stays disabled.
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.12),transparent_28%),#07100d] p-4 md:p-6">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Lyric viewport
                  </div>
                  <div className="mt-1 text-sm text-white/60">
                    {item.status === "matching"
                      ? "Lyrics matching is running in the background. Refresh if the result just landed."
                      : isSyncDisabled
                        ? "Spotify items keep lyrics readable here without synced highlighting."
                        : displayedCues.length > 0
                          ? "Click a line to jump playback and refine rehearsal timing."
                          : "Draft cues will appear automatically once lyrics are available."}
                  </div>
                </div>
                {!isSyncDisabled && displayedCues.length > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
                    Cue {Math.min(activeCueIndex + 1, displayedCues.length)} / {displayedCues.length}
                  </span>
                )}
              </div>

              <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
                {lyricsLines.length === 0 ? (
                  <div className="flex h-full min-h-[340px] items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-black/20 px-6 py-10 text-center text-sm leading-6 text-white/45">
                    {item.status === "matching"
                      ? "The track is in the lyrics queue. Manual lyrics stay hidden until matching fails, but you can still open the recovery panel if you need it now."
                      : "No usable lyrics are attached yet. Open the recovery panel only if automatic matching missed this song."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lyricsLines.map((line, index) => {
                      const cue = displayedCues[index];
                      const isActive = !isSyncDisabled && index === activeCueIndex;

                      return (
                        <button
                          key={line.id}
                          type="button"
                          onClick={() => void handleCueSeek(index)}
                          className={cn(
                            "flex w-full flex-col rounded-[26px] border px-4 py-4 text-left transition-all",
                            isActive
                              ? "border-emerald-300/35 bg-emerald-300/10 shadow-[0_0_0_1px_rgba(110,231,183,0.12)]"
                              : "border-white/[0.08] bg-black/20 hover:border-white/[0.14] hover:bg-white/[0.03]",
                            isSyncDisabled && "cursor-default"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <p
                              className={cn(
                                "text-lg leading-8 text-white/72 md:text-[1.15rem]",
                                isActive && "text-white"
                              )}
                            >
                              {line.text}
                            </p>
                            {!isSyncDisabled && cue && (
                              <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55">
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
          </section>
        </main>

        <aside className="flex min-h-0 flex-col gap-5">
          <section className="min-h-0 rounded-[28px] border border-white/10 bg-black/25 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-white">
                  {activeSetlist?.name ?? "Setlist"}
                </h2>
                <p className="text-sm text-white/50">
                  Keep the next songs visible without leaving rehearsal.
                </p>
              </div>
              {queueIndex >= 0 && (
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">
                  {queueIndex + 1}/{activeSetlist?.items.length ?? 1}
                </span>
              )}
            </div>

            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {activeSetlist?.items.length ? (
                activeSetlist.items.map((setlistItem) => {
                  const queueItem = setlistItem.item;
                  const active = setlistItem.karaokeItemId === item.id;

                  return (
                    <Link
                      key={setlistItem.id}
                      href={
                        queueItem
                          ? `/karaoke/${queueItem.id}?setlist=${activeSetlist.id}`
                          : "#"
                      }
                      className={cn(
                        "block rounded-2xl border px-3 py-3 transition-colors",
                        active
                          ? "border-emerald-400/30 bg-emerald-400/[0.08]"
                          : "border-white/8 bg-white/[0.03] hover:border-white/20"
                      )}
                    >
                      <div className="truncate font-medium text-white">
                        {queueItem?.title ?? "Unavailable item"}
                      </div>
                      <div className="truncate text-sm text-white/55">
                        {queueItem?.artist ?? "This song is no longer available"}
                      </div>
                      {queueItem && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                              getStatusTone(queueItem.status)
                            )}
                          >
                            {STATUS_COPY[queueItem.status]}
                          </span>
                        </div>
                      )}
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-white/45">
                  This song is not attached to a loaded setlist yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-black/25">
            <button
              type="button"
              onClick={() => setLyricsPanelOpen((open) => !open)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <div className="text-sm font-medium text-white">Fix lyrics</div>
                <div className="text-xs text-white/50">
                  Recovery path when automatic matching misses or needs cleanup.
                </div>
              </div>
              <Wrench className="size-4 text-white/50" />
            </button>
            {lyricsPanelOpen && (
              <div className="border-t border-white/8 px-4 pb-4 pt-2">
                <div className="mb-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-white/55">
                  Source: {item.lyrics?.source ?? item.lastMatchSource ?? "unmatched"}
                </div>
                <textarea
                  value={lyricsDraft}
                  onChange={(event) => setLyricsDraft(event.target.value)}
                  placeholder="Paste lyrics only if the automatic match missed this song."
                  className="min-h-[220px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/30 focus:border-emerald-300/35"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void saveLyrics()}
                    disabled={isSavingLyrics}
                  >
                    {isSavingLyrics ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save lyrics
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => setLyricsDraft(joinLyricsLines(item.lyrics?.lines ?? []))}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </section>

          {!isSyncDisabled && (
            <section className="rounded-[28px] border border-white/10 bg-black/25">
              <button
                type="button"
                onClick={() => setTimingPanelOpen((open) => !open)}
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <div>
                  <div className="text-sm font-medium text-white">Adjust sync</div>
                  <div className="text-xs text-white/50">
                    Refine cue timings only after lyrics are usable.
                  </div>
                </div>
                <Sparkles className="size-4 text-white/50" />
              </button>
              {timingPanelOpen && (
                <div className="border-t border-white/8 px-4 pb-4 pt-2">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={regenerateTiming}>
                      <Sparkles className="size-4" />
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                      disabled={isSavingTimeline || draftCues.length === 0}
                      onClick={() => void saveTimeline()}
                    >
                      {isSavingTimeline ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                      disabled={isSavingTimeline || !hasSavedTimeline}
                      onClick={() => void clearTimeline()}
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {draftCues.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                        Draft timing appears once lyrics are available.
                      </div>
                    ) : (
                      draftCues.map((cue, index) => (
                        <div
                          key={`${cue.startOffset}-${cue.endOffset}-${index}`}
                          className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"
                        >
                          <div className="mb-2 line-clamp-2 text-sm text-white/80">{cue.text}</div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="space-y-1 text-xs text-white/50">
                              <span>Start</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={formatSeconds(cue.startMs)}
                                onChange={(event) =>
                                  updateCue(index, "startMs", event.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/35"
                              />
                            </label>
                            <label className="space-y-1 text-xs text-white/50">
                              <span>End</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={formatSeconds(cue.endMs)}
                                onChange={(event) =>
                                  updateCue(index, "endMs", event.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/35"
                              />
                            </label>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
