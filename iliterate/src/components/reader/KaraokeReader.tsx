"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWordAudio } from "@/lib/tts/use-word-audio";
import { cn } from "@/lib/utils";
import { ReaderSegment } from "./karaoke";

interface KaraokeReaderProps {
  segments: ReaderSegment[];
  activeSegmentIndex: number;
  language: string;
  onActiveSegmentIndexChange: (index: number) => void;
  className?: string;
}

const PLAYBACK_PRESETS = [
  { label: "Slow", value: 0.85 },
  { label: "Steady", value: 1 },
  { label: "Fast", value: 1.2 },
] as const;

export function KaraokeReader({
  segments,
  activeSegmentIndex,
  language,
  onActiveSegmentIndexChange,
  className,
}: KaraokeReaderProps) {
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] =
    useState<(typeof PLAYBACK_PRESETS)[number]["value"]>(1);
  const { play, loading } = useWordAudio();

  const activeSegment = segments[activeSegmentIndex] ?? null;
  const totalSegments = segments.length;
  const segmentProgress =
    totalSegments > 0 ? Math.round(((activeSegmentIndex + 1) / totalSegments) * 100) : 0;

  useEffect(() => {
    if (!isAutoPlaying || !activeSegment) return;

    const duration =
      Math.max(
        900,
        ((activeSegment.endMs ?? 0) - (activeSegment.startMs ?? 0)) / playbackRate
      ) || 1800;

    const timeoutId = window.setTimeout(() => {
      if (activeSegmentIndex >= totalSegments - 1) {
        setIsAutoPlaying(false);
        return;
      }

      onActiveSegmentIndexChange(activeSegmentIndex + 1);
    }, duration);

    return () => window.clearTimeout(timeoutId);
  }, [
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

  const previewLabel = useMemo(() => {
    if (!activeSegment) return "No segment available";

    const compact = activeSegment.text.replace(/\s+/g, " ").trim();
    if (compact.length <= 72) return compact;
    return `${compact.slice(0, 69)}...`;
  }, [activeSegment]);

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
        <div className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-medium tabular-nums">
          {totalSegments === 0 ? "0 / 0" : `${activeSegmentIndex + 1} / ${totalSegments}`}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          onClick={() => onActiveSegmentIndexChange(Math.max(activeSegmentIndex - 1, 0))}
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
          onClick={() =>
            activeSegment && play(activeSegment.text, language)
          }
          disabled={!activeSegment || loading}
          title="Speak current segment"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          onClick={() =>
            onActiveSegmentIndexChange(
              Math.min(activeSegmentIndex + 1, Math.max(totalSegments - 1, 0))
            )
          }
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
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
          style={{ width: `${segmentProgress}%` }}
        />
      </div>
    </div>
  );
}
