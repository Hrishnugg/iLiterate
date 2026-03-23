"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Pause, SkipForward, SkipBack, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  contentId: string;
  lessonId?: string;
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

export function AudioPlayer({ contentId, lessonId, language, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
        toast.error("Audio playback failed. Please try again.");
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

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lessonId ? { lessonId } : { contentId }),
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
      toast.error(message);
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
  }, [contentId, releaseAudio]);

  useEffect(() => {
    return () => {
      releaseAudio();
    };
  }, [releaseAudio]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  const progress = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
  const hasAudio = Boolean(audioRef.current);

  const btnBase = "text-primary-foreground hover:bg-white/20 hover:text-primary-foreground disabled:opacity-40";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button variant="ghost" size="icon" className={cn("size-8 shrink-0", btnBase)} onClick={() => skip(-10)} disabled={!hasAudio || isLoading}>
        <SkipBack className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        disabled={isLoading}
        className={cn("gap-2 px-3 rounded-md bg-white/20 hover:bg-white/30 text-primary-foreground shrink-0", isPlaying && !isPaused && "bg-white/30")}
      >
        {isLoading ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
        ) : isPlaying && !isPaused ? (
          <><Pause className="h-4 w-4" />Pause</>
        ) : (
          <><Play className="h-4 w-4" />{isPaused ? "Resume" : "Listen"}</>
        )}
      </Button>

      <Button variant="ghost" size="icon" className={cn("size-8 shrink-0", btnBase)} onClick={() => skip(10)} disabled={!hasAudio || isLoading}>
        <SkipForward className="h-4 w-4" />
      </Button>

      {(isPlaying || isPaused) && (
        <Button variant="ghost" size="sm" onClick={stop} className="text-primary-foreground/70 hover:bg-white/20 hover:text-primary-foreground px-2 shrink-0">
          Stop
        </Button>
      )}

      {(isPlaying || isPaused) && (
        <span className="text-xs text-primary-foreground/60 tabular-nums shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      )}

      <div className="flex items-center gap-2 ml-auto">
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.rate}
          onChange={(e) => setSettings((s) => ({ ...s, rate: parseFloat(e.target.value) }))}
          className="w-24 accent-white"
          title="Playback speed"
        />
        <span className="text-xs text-primary-foreground/70 tabular-nums shrink-0">{settings.rate.toFixed(1)}x</span>
      </div>
    </div>
  );
}
