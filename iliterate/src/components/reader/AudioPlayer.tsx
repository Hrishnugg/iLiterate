"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Volume2,
  SkipForward,
  SkipBack,
  Settings,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  contentId: string;
  language: string;
  className?: string;
}

interface PlaybackSettings {
  rate: number;
  volume: number;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ contentId, language, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PlaybackSettings>({
    rate: 1,
    volume: 1,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const generatedContentRef = useRef<string | null>(null);

  const clearAudioUrl = useCallback(() => {
    if (!audioUrlRef.current) return;
    URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }, []);

  const detachAudioElement = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.onplay = null;
    audio.onpause = null;
    audio.onended = null;
    audio.onloadedmetadata = null;
    audio.ontimeupdate = null;
    audio.onerror = null;
    audio.src = "";
    audioRef.current = null;
  }, []);

  const resetPlaybackState = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const releaseAudio = useCallback(() => {
    detachAudioElement();
    clearAudioUrl();
    generatedContentRef.current = null;
    resetPlaybackState();
  }, [detachAudioElement, clearAudioUrl, resetPlaybackState]);

  const bindAudioEvents = useCallback(
    (audio: HTMLAudioElement) => {
      audio.playbackRate = settings.rate;
      audio.volume = settings.volume;

      audio.onplay = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };

      audio.onpause = () => {
        setIsPlaying(false);
        setIsPaused(audio.currentTime > 0 && !audio.ended);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(0);
      };

      audio.onloadedmetadata = () => {
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
        setCurrentTime(audio.currentTime);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onerror = () => {
        setError("Audio playback failed. Please try again.");
        releaseAudio();
      };
    },
    [releaseAudio, settings.rate, settings.volume]
  );

  const ensureAudio = useCallback(async () => {
    if (audioRef.current && generatedContentRef.current === contentId) {
      return audioRef.current;
    }

    releaseAudio();
    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contentId }),
    });

    if (!response.ok) {
      let message = "Failed to generate audio";
      try {
        const payload = await response.json();
        if (
          payload &&
          typeof payload === "object" &&
          typeof (payload as { error?: unknown }).error === "string"
        ) {
          message = (payload as { error: string }).error;
        }
      } catch {
        // Ignore invalid JSON and keep default message.
      }
      throw new Error(message);
    }

    const audioBlob = await response.blob();
    const objectUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(objectUrl);

    audioUrlRef.current = objectUrl;
    generatedContentRef.current = contentId;
    audioRef.current = audio;
    bindAudioEvents(audio);

    setIsLoading(false);
    return audio;
  }, [bindAudioEvents, contentId, releaseAudio]);

  const togglePlay = useCallback(async () => {
    if (isLoading) return;

    setError(null);

    try {
      const audio = await ensureAudio();
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start audio playback";
      setError(message);
      releaseAudio();
    } finally {
      setIsLoading(false);
    }
  }, [ensureAudio, isLoading, releaseAudio]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextTime = Math.max(
      0,
      Math.min(
        Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + seconds,
        audio.currentTime + seconds
      )
    );
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = settings.rate;
  }, [settings.rate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = settings.volume;
  }, [settings.volume]);

  useEffect(() => {
    releaseAudio();
    setError(null);
  }, [contentId, releaseAudio]);

  useEffect(() => {
    return () => {
      releaseAudio();
    };
  }, [releaseAudio]);

  const progress = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
  const hasAudio = Boolean(audioRef.current);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => skip(-10)}
          disabled={!hasAudio || isLoading}
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant={isPlaying && !isPaused ? "default" : "outline"}
          size="sm"
          onClick={togglePlay}
          className="gap-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : isPlaying && !isPaused ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {isPaused ? "Resume" : "Listen"}
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => skip(10)}
          disabled={!hasAudio || isLoading}
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        {(isPlaying || isPaused) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={stop}
            className="text-destructive hover:text-destructive"
          >
            Stop
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className={cn(showSettings && "bg-accent")}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-3">
          {/* Speed control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Speed</span>
              <span>{settings.rate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.rate}
              onChange={(e) => {
                const newRate = parseFloat(e.target.value);
                setSettings((s) => ({ ...s, rate: newRate }));
              }}
              className="w-full"
            />
          </div>

          {/* Volume control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Volume2 className="h-3 w-3" />
                Volume
              </span>
              <span>{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value);
                setSettings((s) => ({ ...s, volume: newVolume }));
              }}
              className="w-full"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Voice: Auto ({language})
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {(isPlaying || isPaused) && (
        <div className="text-xs text-muted-foreground">
          Reading: {progress}% ({formatTime(currentTime)} / {formatTime(duration)})
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}
    </div>
  );
}
