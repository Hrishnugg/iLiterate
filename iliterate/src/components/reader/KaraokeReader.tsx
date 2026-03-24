"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Link2,
  Loader2,
  Music4,
  Pause,
  Play,
  Save,
  SkipBack,
  SkipForward,
  Unlink,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWordAudio } from "@/lib/tts/use-word-audio";
import {
  KaraokePlaybackProvider,
  KaraokeTrackLink,
} from "@/types/database";
import { ProviderStatus } from "@/lib/karaoke/providers";
import {
  findActiveReaderSegmentIndex,
  ReaderSegment,
  serializeReaderSegmentsToCues,
} from "./karaoke";

interface KaraokeReaderProps {
  contentId: string | null;
  segments: ReaderSegment[];
  activeSegmentIndex: number;
  language: string;
  activeProvider: KaraokePlaybackProvider;
  providerStatuses: ProviderStatus[];
  linkedTracks: KaraokeTrackLink[];
  hasStoredTimeline: boolean;
  onActiveProviderChange: (provider: KaraokePlaybackProvider) => void;
  onActiveSegmentIndexChange: (index: number) => void;
  onRefreshProviders: () => Promise<void>;
  onRefreshContentState: () => Promise<void>;
  className?: string;
}

const PLAYBACK_PRESETS = [
  { label: "Slow", value: 0.85 },
  { label: "Steady", value: 1 },
  { label: "Fast", value: 1.2 },
] as const;

type SoundCloudWidget = {
  bind: (eventName: string, listener: (event: { currentPosition?: number }) => void) => void;
  unbind: (eventName: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (milliseconds: number) => void;
};

type MusicKitInstance = {
  authorize: () => Promise<string>;
  setQueue: (descriptor: { url: string }) => Promise<unknown>;
  play: () => Promise<unknown>;
  pause: () => Promise<unknown>;
  player: {
    currentPlaybackTime?: number;
    isPlaying?: boolean;
    seekToTime?: (seconds: number) => Promise<unknown>;
  };
};

function formatProviderLabel(provider: KaraokePlaybackProvider): string {
  switch (provider) {
    case "soundcloud":
      return "SoundCloud";
    case "apple_music":
      return "Apple Music";
    case "spotify":
      return "Spotify";
    default:
      return "Guided";
  }
}

function loadExternalScript(src: string, marker: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if ((window as unknown as Record<string, unknown>)[marker]) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-karaoke-script="${marker}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${marker}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.karaokeScript = marker;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${marker}`));
    document.body.appendChild(script);
  });
}

export function KaraokeReader({
  contentId,
  segments,
  activeSegmentIndex,
  language,
  activeProvider,
  providerStatuses,
  linkedTracks,
  hasStoredTimeline,
  onActiveProviderChange,
  onActiveSegmentIndexChange,
  onRefreshProviders,
  onRefreshContentState,
  className,
}: KaraokeReaderProps) {
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] =
    useState<(typeof PLAYBACK_PRESETS)[number]["value"]>(1);
  const [trackUrl, setTrackUrl] = useState("");
  const [isLinkingTrack, setIsLinkingTrack] = useState(false);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);
  const [providerAction, setProviderAction] = useState<string | null>(null);
  const [providerPlaying, setProviderPlaying] = useState(false);
  const [providerPositionMs, setProviderPositionMs] = useState(0);
  const [soundCloudReady, setSoundCloudReady] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const { play, loading } = useWordAudio();

  const soundCloudIframeRef = useRef<HTMLIFrameElement | null>(null);
  const soundCloudWidgetRef = useRef<SoundCloudWidget | null>(null);
  const appleMusicRef = useRef<MusicKitInstance | null>(null);
  const applePollingRef = useRef<number | null>(null);

  const activeSegment = segments[activeSegmentIndex] ?? null;
  const totalSegments = segments.length;
  const segmentProgress =
    totalSegments > 0 ? Math.round(((activeSegmentIndex + 1) / totalSegments) * 100) : 0;
  const activeTrack = linkedTracks.find((track) => track.provider === activeProvider) ?? null;
  const activeProviderStatus = providerStatuses.find(
    (status) => status.provider === activeProvider
  );
  const hasEmbeddedTrack =
    activeTrack?.playbackMode === "embedded" && activeProvider !== "spotify";

  const previewLabel = useMemo(() => {
    if (!activeSegment) return "No segment available";

    const compact = activeSegment.text.replace(/\s+/g, " ").trim();
    if (compact.length <= 72) return compact;
    return `${compact.slice(0, 69)}...`;
  }, [activeSegment]);

  useEffect(() => {
    setTrackUrl("");
    setProviderPlaying(false);
    setProviderPositionMs(0);
  }, [activeProvider]);

  useEffect(() => {
    if (!isAutoPlaying || !activeSegment || activeProvider !== "tts") return;

    const duration =
      Math.max(900, (activeSegment.endMs - activeSegment.startMs) / playbackRate) || 1800;

    const timeoutId = window.setTimeout(() => {
      if (activeSegmentIndex >= totalSegments - 1) {
        setIsAutoPlaying(false);
        return;
      }

      onActiveSegmentIndexChange(activeSegmentIndex + 1);
    }, duration);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeProvider,
    activeSegment,
    activeSegmentIndex,
    isAutoPlaying,
    onActiveSegmentIndexChange,
    playbackRate,
    totalSegments,
  ]);

  useEffect(() => {
    if (activeSegmentIndex >= totalSegments && totalSegments > 0) {
      onActiveSegmentIndexChange(totalSegments - 1);
    }
  }, [activeSegmentIndex, onActiveSegmentIndexChange, totalSegments]);

  useEffect(() => {
    if (
      (activeProvider === "soundcloud" || activeProvider === "apple_music") &&
      segments.length > 0
    ) {
      onActiveSegmentIndexChange(findActiveReaderSegmentIndex(segments, providerPositionMs));
    }
  }, [activeProvider, onActiveSegmentIndexChange, providerPositionMs, segments]);

  const initializeAppleMusic = useCallback(async () => {
    await loadExternalScript(
      "https://js-cdn.music.apple.com/musickit/v1/musickit.js",
      "MusicKit"
    );

    const musicKitGlobal = window as unknown as {
      MusicKit?: {
        configure: (config: {
          developerToken: string;
          storefrontId: string;
          features: string[];
        }) => void;
        getInstance: () => MusicKitInstance;
      };
    };

    if (!musicKitGlobal.MusicKit) {
      throw new Error("MusicKit JS failed to load");
    }

    const tokenResponse = await fetch("/api/karaoke/providers/apple_music/token");
    if (!tokenResponse.ok) {
      const payload = (await tokenResponse.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Apple Music is not configured");
    }

    const tokenPayload = (await tokenResponse.json()) as {
      developerToken: string;
      storefront: string;
    };

    if (!appleMusicRef.current) {
      musicKitGlobal.MusicKit.configure({
        developerToken: tokenPayload.developerToken,
        storefrontId: tokenPayload.storefront || "us",
        features: ["player-accurate-timing"],
      });
      appleMusicRef.current = musicKitGlobal.MusicKit.getInstance();
    }

    setAppleReady(true);
    return appleMusicRef.current;
  }, []);

  const persistAppleMusicConnection = useCallback(async () => {
    const instance = await initializeAppleMusic();
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

    await onRefreshProviders();
    toast.success("Apple Music connected");
  }, [initializeAppleMusic, onRefreshProviders]);

  const syncApplePolling = useCallback(() => {
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

  useEffect(() => {
    return () => {
      if (applePollingRef.current) {
        window.clearInterval(applePollingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeProvider !== "soundcloud" || !activeTrack || !soundCloudIframeRef.current) {
      setSoundCloudReady(false);
      return;
    }

    let mounted = true;

    const setupWidget = async () => {
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
                FINISH: string;
              };
            };
          };
        };

        if (!mounted || !scWindow.SC?.Widget || !soundCloudIframeRef.current) {
          return;
        }

        const widget = scWindow.SC.Widget(soundCloudIframeRef.current);
        soundCloudWidgetRef.current = widget;

        widget.bind(scWindow.SC.Widget.Events.READY, () => {
          if (!mounted) return;
          setSoundCloudReady(true);
        });
        widget.bind(scWindow.SC.Widget.Events.PLAY, () => {
          if (!mounted) return;
          setProviderPlaying(true);
        });
        widget.bind(scWindow.SC.Widget.Events.PAUSE, () => {
          if (!mounted) return;
          setProviderPlaying(false);
        });
        widget.bind(scWindow.SC.Widget.Events.FINISH, () => {
          if (!mounted) return;
          setProviderPlaying(false);
          if (segments.length > 0) {
            onActiveSegmentIndexChange(segments.length - 1);
          }
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

    setupWidget();

    return () => {
      mounted = false;
    };
  }, [activeProvider, activeTrack, onActiveSegmentIndexChange, segments]);

  const linkTrack = useCallback(async () => {
    if (!contentId) {
      toast.error("External karaoke links are only available for saved library content.");
      return;
    }

    if (!trackUrl.trim()) {
      toast.error("Paste a Spotify, Apple Music, or SoundCloud track URL.");
      return;
    }

    setIsLinkingTrack(true);
    try {
      const response = await fetch(`/api/karaoke/content/${contentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trackUrl.trim() }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to link track");
      }

      setTrackUrl("");
      await onRefreshContentState();
      toast.success("Linked karaoke track");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to link karaoke track";
      toast.error(message);
    } finally {
      setIsLinkingTrack(false);
    }
  }, [contentId, onRefreshContentState, trackUrl]);

  const removeTrack = useCallback(async () => {
    if (activeProvider === "tts") return;

    if (!contentId) return;

    setProviderAction("unlink");
    try {
      const response = await fetch(
        `/api/karaoke/content/${contentId}?provider=${activeProvider}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to remove linked track");
      }

      await onRefreshContentState();
      toast.success(`${formatProviderLabel(activeProvider)} track removed`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove linked track";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [activeProvider, contentId, onRefreshContentState]);

  const saveTimeline = useCallback(async () => {
    if (segments.length === 0) {
      toast.error("No guided timing is available to save yet.");
      return;
    }

    setIsSavingTimeline(true);
    try {
      if (!contentId) {
        throw new Error("Provider-backed karaoke is unavailable for this item.");
      }

      const response = await fetch(`/api/karaoke/content/${contentId}/timeline`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: activeProvider,
          cues: serializeReaderSegmentsToCues(segments),
          metadata: {
            source: activeProvider === "tts" ? "guided_reader" : "provider_guided_reader",
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to save karaoke timing");
      }

      await onRefreshContentState();
      toast.success(`Saved timing for ${formatProviderLabel(activeProvider)}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save karaoke timing";
      toast.error(message);
    } finally {
      setIsSavingTimeline(false);
    }
  }, [activeProvider, contentId, onRefreshContentState, segments]);

  const disconnectProvider = useCallback(async () => {
    if (activeProvider === "tts") return;

    setProviderAction("disconnect");
    try {
      const response = await fetch(`/api/karaoke/providers/${activeProvider}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to disconnect provider");
      }

      await onRefreshProviders();
      toast.success(`${formatProviderLabel(activeProvider)} disconnected`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect provider";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [activeProvider, onRefreshProviders]);

  const startSpotifyConnect = useCallback(async () => {
    setProviderAction("connect");
    try {
      const response = await fetch(
        `/api/karaoke/providers/spotify/start?returnTo=${encodeURIComponent(window.location.pathname)}`
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to connect Spotify");
      }

      const payload = (await response.json()) as { authorizeUrl: string };
      window.location.assign(payload.authorizeUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect Spotify";
      toast.error(message);
      setProviderAction(null);
    }
  }, []);

  const toggleApplePlayback = useCallback(async () => {
    if (!activeTrack) {
      toast.error("Link an Apple Music track first.");
      return;
    }

    try {
      setProviderAction("apple-play");
      const instance = await initializeAppleMusic();
      if (!activeProviderStatus?.connected) {
        await persistAppleMusicConnection();
      }

      if (!appleReady) {
        setAppleReady(true);
      }

      await instance.setQueue({ url: activeTrack.url });

      if (providerPlaying) {
        await instance.pause();
        setProviderPlaying(false);
      } else {
        await instance.play();
        setProviderPlaying(true);
      }

      syncApplePolling();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to control Apple Music playback";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [
    activeProviderStatus?.connected,
    activeTrack,
    appleReady,
    initializeAppleMusic,
    persistAppleMusicConnection,
    providerPlaying,
    syncApplePolling,
  ]);

  const seekAppleToSegment = useCallback(
    async (index: number) => {
      const instance = appleMusicRef.current;
      const segment = segments[index];
      if (!instance || !segment) return;

      await instance.player.seekToTime?.(segment.startMs / 1000);
      setProviderPositionMs(segment.startMs);
      onActiveSegmentIndexChange(index);
    },
    [onActiveSegmentIndexChange, segments]
  );

  const seekSoundCloudToSegment = useCallback(
    (index: number) => {
      const segment = segments[index];
      if (!segment) return;

      soundCloudWidgetRef.current?.seekTo(segment.startMs);
      setProviderPositionMs(segment.startMs);
      onActiveSegmentIndexChange(index);
    },
    [onActiveSegmentIndexChange, segments]
  );

  const handleProviderStep = useCallback(
    async (direction: -1 | 1) => {
      const nextIndex = Math.max(0, Math.min(totalSegments - 1, activeSegmentIndex + direction));
      if (nextIndex === activeSegmentIndex) return;

      if (activeProvider === "apple_music") {
        await seekAppleToSegment(nextIndex);
        return;
      }

      if (activeProvider === "soundcloud") {
        seekSoundCloudToSegment(nextIndex);
        return;
      }

      onActiveSegmentIndexChange(nextIndex);
    },
    [
      activeProvider,
      activeSegmentIndex,
      onActiveSegmentIndexChange,
      seekAppleToSegment,
      seekSoundCloudToSegment,
      totalSegments,
    ]
  );

  const renderProviderControls = () => {
    if (activeProvider === "tts") {
      return (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => void handleProviderStep(-1)}
            disabled={activeSegmentIndex <= 0}
            title="Previous segment"
          >
            <SkipBack className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => setIsAutoPlaying((current) => !current)}
            disabled={!activeSegment}
            title={isAutoPlaying ? "Pause guided playback" : "Play guided playback"}
          >
            {isAutoPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => activeSegment && play(activeSegment.text, language)}
            disabled={!activeSegment || loading}
            title="Speak current segment"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => void handleProviderStep(1)}
            disabled={activeSegmentIndex >= totalSegments - 1 || totalSegments === 0}
            title="Next segment"
          >
            <SkipForward className="size-4" />
          </Button>

          <div className="ml-auto flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1">
            {PLAYBACK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setPlaybackRate(preset.value)}
                className={cn(
                  "rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
                  playbackRate === preset.value
                    ? "bg-white text-primary"
                    : "text-primary-foreground/75 hover:bg-white/10 hover:text-primary-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      );
    }

    if (activeProvider === "soundcloud") {
      return (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => void handleProviderStep(-1)}
            disabled={activeSegmentIndex <= 0 || !soundCloudReady}
            title="Previous cue"
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => {
              if (providerPlaying) {
                soundCloudWidgetRef.current?.pause();
              } else {
                soundCloudWidgetRef.current?.play();
              }
            }}
            disabled={!activeTrack}
            title={providerPlaying ? "Pause SoundCloud" : "Play SoundCloud"}
          >
            {providerPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => void handleProviderStep(1)}
            disabled={activeSegmentIndex >= totalSegments - 1 || !soundCloudReady}
            title="Next cue"
          >
            <SkipForward className="size-4" />
          </Button>
        </>
      );
    }

    if (activeProvider === "apple_music") {
      return (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => void handleProviderStep(-1)}
            disabled={activeSegmentIndex <= 0 || !activeTrack}
            title="Previous cue"
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => void toggleApplePlayback()}
            disabled={!activeTrack || providerAction === "apple-play"}
            title={providerPlaying ? "Pause Apple Music" : "Play Apple Music"}
          >
            {providerAction === "apple-play" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : providerPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={() => void handleProviderStep(1)}
            disabled={activeSegmentIndex >= totalSegments - 1 || !activeTrack}
            title="Next cue"
          >
            <SkipForward className="size-4" />
          </Button>
        </>
      );
    }

    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          onClick={() => activeTrack && window.open(activeTrack.url, "_blank", "noopener,noreferrer")}
          disabled={!activeTrack}
        >
          <ExternalLink className="mr-2 size-4" />
          Open in Spotify
        </Button>
        <span className="ml-auto text-xs text-primary-foreground/70">
          Spotify playback stays link-out only in karaoke mode.
        </span>
      </>
    );
  };

  const renderProviderConnection = () => {
    if (activeProvider === "tts") {
      return (
        <p className="text-xs text-primary-foreground/70">
          Use the built-in guided reader and save its timing as a reusable karaoke timeline.
        </p>
      );
    }

    if (activeProvider === "soundcloud") {
      return (
        <p className="text-xs text-primary-foreground/70">
          SoundCloud works without account auth. Link a public track URL to drive synced playback.
        </p>
      );
    }

    if (!activeProviderStatus?.configured) {
      return (
        <p className="text-xs text-amber-200">
          {formatProviderLabel(activeProvider)} is not configured in the current environment.
        </p>
      );
    }

    if (activeProvider === "apple_music" && !activeProviderStatus.connected) {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={providerAction === "connect"}
          onClick={async () => {
            try {
              setProviderAction("connect");
              await persistAppleMusicConnection();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Failed to connect Apple Music";
              toast.error(message);
            } finally {
              setProviderAction(null);
            }
          }}
        >
          {providerAction === "connect" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Music4 className="mr-2 size-4" />
          )}
          Connect Apple Music
        </Button>
      );
    }

    if (activeProvider === "spotify" && !activeProviderStatus.connected) {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={providerAction === "connect"}
          onClick={() => void startSpotifyConnect()}
        >
          {providerAction === "connect" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Music4 className="mr-2 size-4" />
          )}
          Connect Spotify
        </Button>
      );
    }

    return (
      <Button
        variant="secondary"
        size="sm"
        disabled={providerAction === "disconnect"}
        onClick={() => void disconnectProvider()}
      >
        {providerAction === "disconnect" ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Unlink className="mr-2 size-4" />
        )}
        Disconnect {formatProviderLabel(activeProvider)}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-white/10 px-4 py-3 text-primary-foreground",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0">
          <p className="font-medium uppercase tracking-[0.16em] text-primary-foreground/70">
            Guided Reader
          </p>
          <p className="truncate text-sm font-medium text-primary-foreground">
            {previewLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-medium tabular-nums">
            {totalSegments === 0 ? "0 / 0" : `${activeSegmentIndex + 1} / ${totalSegments}`}
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-medium">
            {formatProviderLabel(activeProvider)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["tts", "soundcloud", "apple_music", "spotify"] as const).map((provider) => {
          const linked = linkedTracks.some((track) => track.provider === provider);
          const configured =
            provider === "tts" ||
            provider === "soundcloud" ||
            providerStatuses.some(
              (status) => status.provider === provider && status.configured
            );

          return (
            <button
              key={provider}
              type="button"
              onClick={() => onActiveProviderChange(provider)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeProvider === provider
                  ? "border-white/40 bg-white text-primary"
                  : "border-white/15 bg-white/10 text-primary-foreground/80 hover:bg-white/15 hover:text-primary-foreground",
                !configured && "opacity-60"
              )}
            >
              {formatProviderLabel(provider)}
              {linked ? " linked" : ""}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-foreground/70">
              Track Link
            </p>
            {activeTrack ? (
              <div className="mt-2 flex items-start gap-3">
                {activeTrack.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeTrack.artworkUrl}
                    alt=""
                    className="size-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-lg bg-white/10">
                    <Music4 className="size-5 text-primary-foreground/70" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{activeTrack.title}</p>
                  <p className="truncate text-xs text-primary-foreground/70">{activeTrack.artist}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => window.open(activeTrack.url, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="mr-2 size-4" />
                      Open Track
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
                      onClick={() => void removeTrack()}
                      disabled={providerAction === "unlink"}
                    >
                      {providerAction === "unlink" ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Unlink className="mr-2 size-4" />
                      )}
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : activeProvider === "tts" ? (
              <p className="mt-2 text-sm text-primary-foreground/70">
                No external track is linked for the built-in guided reader.
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={trackUrl}
                    onChange={(event) => setTrackUrl(event.target.value)}
                    placeholder={`Paste a ${formatProviderLabel(activeProvider)} track URL`}
                    className="border-white/15 bg-white/5 text-primary-foreground placeholder:text-primary-foreground/40"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void linkTrack()}
                    disabled={isLinkingTrack || !contentId}
                  >
                    {isLinkingTrack ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 size-4" />
                    )}
                    Link Track
                  </Button>
                </div>
                <p className="text-xs text-primary-foreground/70">
                  URL-first linking is enabled for Spotify, Apple Music, and SoundCloud.
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {renderProviderConnection()}
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              onClick={() => void saveTimeline()}
              disabled={isSavingTimeline || segments.length === 0}
            >
              {isSavingTimeline ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {hasStoredTimeline ? "Update Timing" : "Save Current Timing"}
            </Button>
          </div>
        </div>

        {activeProvider === "spotify" && (
          <p className="mt-3 text-xs text-amber-200">
            Spotify-linked tracks stay unsynced in karaoke mode. The official platform policy
            blocks synchronizing Spotify recordings with visual media, so this provider is
            intentionally link-out only here.
          </p>
        )}
      </div>

      {activeProvider === "soundcloud" && activeTrack && (
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
          <iframe
            ref={soundCloudIframeRef}
            title="SoundCloud karaoke player"
            width="100%"
            height="166"
            scrolling="no"
            allow="autoplay"
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(activeTrack.url)}&auto_play=false&show_artwork=true&show_user=true`}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">{renderProviderControls()}</div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
          style={{ width: `${segmentProgress}%` }}
        />
      </div>

      {hasEmbeddedTrack && (
        <p className="text-[11px] text-primary-foreground/60">
          Embedded playback is driving segment highlights. Click Previous/Next to jump by cue.
        </p>
      )}
      {appleReady && activeProvider === "apple_music" && !activeProviderStatus?.connected && (
        <p className="text-[11px] text-primary-foreground/60">
          Apple Music is ready in this browser, but you still need to persist the connection for
          future sessions.
        </p>
      )}
    </div>
  );
}
