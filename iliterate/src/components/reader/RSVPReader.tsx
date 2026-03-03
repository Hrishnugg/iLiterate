"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Settings,
  StopCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function isCJKLanguage(lang: string): boolean {
  const l = lang.toLowerCase();
  return l.includes("chinese") || l.includes("japanese") || l.includes("korean");
}

interface RSVPReaderProps {
  text: string;
  language?: string;
  initialPosition?: number;
  onPositionChange?: (index: number, totalWords: number) => void;
  onWpmChange?: (wpm: number) => void;
  onRegisterSeek?: (seekFn: (percentage: number) => void) => void;
  className?: string;
}

export function RSVPReader({
  text,
  language,
  initialPosition = 0,
  onPositionChange,
  onWpmChange,
  onRegisterSeek,
  className,
}: RSVPReaderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(initialPosition);
  const [wpm, setWpm] = useState(250);
  const [showSettings, setShowSettings] = useState(false);
  const [isEditingWpm, setIsEditingWpm] = useState(false);
  const [wpmInput, setWpmInput] = useState(wpm.toString());
  const [adaptiveSpeed, setAdaptiveSpeed] = useState(false);
  const [wordDifficulties, setWordDifficulties] = useState<number[]>([]);
  const [isLoadingDifficulties, setIsLoadingDifficulties] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wpmInputRef = useRef<HTMLInputElement>(null);

  // Extract words from text
  const [words, setWords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const plainText = text.replace(/<[^>]*>/g, " ");
    if (language && isCJKLanguage(language)) {
      setIsLoading(true);
      fetch("/api/tokenize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plainText, language }),
      })
        .then((r) => r.json())
        .then((data) => setWords(data.tokens ?? []))
        .finally(() => setIsLoading(false));
    } else {
      setWords(plainText.split(/\s+/).filter((w) => w.trim().length > 0));
    }
  }, [text, language]);

  // Fetch word difficulty multipliers when adaptive speed is on
  useEffect(() => {
    if (!adaptiveSpeed || words.length === 0) {
      setWordDifficulties([]);
      return;
    }
    setIsLoadingDifficulties(true);
    fetch("/api/word-difficulty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words, language: language ?? "english" }),
    })
      .then((r) => r.json())
      .then((data) => setWordDifficulties(data.difficulties ?? []))
      .catch(() => setWordDifficulties([]))
      .finally(() => setIsLoadingDifficulties(false));
  }, [adaptiveSpeed, words, language]);

  const totalWords = words.length;
  const currentWord = words[currentWordIndex] || "";
  const progressPercent = totalWords > 0 ? (currentWordIndex / totalWords) * 100 : 0;

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    const wordsLeft = totalWords - currentWordIndex;
    const minutesLeft = wordsLeft / wpm;
    const secondsLeft = Math.round(minutesLeft * 60);

    if (secondsLeft < 60) {
      return `${secondsLeft}s`;
    }

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes}m ${seconds}s`;
  }, [currentWordIndex, totalWords, wpm]);

  // Calculate base milliseconds per word
  const msPerWord = useMemo(() => {
    return (60 / wpm) * 1000;
  }, [wpm]);

  // Cancel any pending timeout
  const clearPlayback = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Play/Pause toggle – restart from beginning if already at the end
  const togglePlay = useCallback(() => {
    if (!isPlaying && currentWordIndex >= totalWords - 1) {
      setCurrentWordIndex(0);
      setTimeout(() => onPositionChange?.(0, totalWords), 0);
    }
    setIsPlaying((prev) => !prev);
  }, [isPlaying, currentWordIndex, totalWords, onPositionChange]);

  // Stop and reset
  const stop = useCallback(() => {
    clearPlayback();
    setIsPlaying(false);
    setCurrentWordIndex(0);
    setTimeout(() => onPositionChange?.(0, totalWords), 0);
  }, [onPositionChange, clearPlayback, totalWords]);

  // Skip forward/backward
  const skip = useCallback(
    (count: number) => {
      setCurrentWordIndex((prev) => {
        const next = Math.max(0, Math.min(totalWords - 1, prev + count));
        setTimeout(() => onPositionChange?.(next, totalWords), 0);
        return next;
      });
    },
    [totalWords, onPositionChange]
  );

  // Seek to specific position (from progress bar)
  const seekToPercentage = useCallback(
    (percentage: number) => {
      const targetIndex = Math.round((percentage / 100) * totalWords);
      const clampedIndex = Math.max(0, Math.min(totalWords - 1, targetIndex));
      setCurrentWordIndex(clampedIndex);
      setTimeout(() => onPositionChange?.(clampedIndex, totalWords), 0);
    },
    [totalWords, onPositionChange]
  );

  // Per-word timeout effect – supports variable delays for adaptive speed
  useEffect(() => {
    if (!isPlaying) {
      clearPlayback();
      return;
    }

    const multiplier =
      adaptiveSpeed && wordDifficulties[currentWordIndex] != null
        ? wordDifficulties[currentWordIndex]
        : 1.0;
    const delay = msPerWord * multiplier;

    timeoutRef.current = setTimeout(() => {
      setCurrentWordIndex((prev) => {
        const next = prev + 1;
        if (next >= totalWords) {
          setIsPlaying(false);
          return prev;
        }
        setTimeout(() => onPositionChange?.(next, totalWords), 0);
        return next;
      });
    }, delay);

    return () => clearPlayback();
  }, [isPlaying, currentWordIndex, msPerWord, totalWords, adaptiveSpeed, wordDifficulties, onPositionChange, clearPlayback]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === "Escape") {
        stop();
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        skip(1);
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        skip(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePlay, stop, skip]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPlayback();
    };
  }, [clearPlayback]);

  // Focus WPM input when editing starts
  useEffect(() => {
    if (isEditingWpm && wpmInputRef.current) {
      wpmInputRef.current.focus();
      wpmInputRef.current.select();
    }
  }, [isEditingWpm]);

  // Handle WPM input change
  const handleWpmInputChange = (value: string) => {
    setWpmInput(value);
  };

  // Handle WPM input blur or enter
  const handleWpmInputSubmit = () => {
    const newWpm = parseInt(wpmInput, 10);
    if (!isNaN(newWpm) && newWpm >= 100 && newWpm <= 600) {
      setWpm(newWpm);
      onWpmChange?.(newWpm);
    } else {
      setWpmInput(wpm.toString());
    }
    setIsEditingWpm(false);
  };

  // Start editing WPM
  const handleWpmClick = () => {
    setIsEditingWpm(true);
    setWpmInput(wpm.toString());
  };

  // Notify parent when component mounts
  useEffect(() => {
    if (totalWords > 0 && onPositionChange) {
      const timeoutId = setTimeout(() => {
        onPositionChange(currentWordIndex, totalWords);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWords]);

  // Notify parent of initial WPM
  useEffect(() => {
    if (onWpmChange) {
      const timeoutId = setTimeout(() => {
        onWpmChange(wpm);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register seek function with parent on mount
  useEffect(() => {
    if (onRegisterSeek) {
      onRegisterSeek(seekToPercentage);
    }
  }, [onRegisterSeek, seekToPercentage]);

  if (isLoading) {
    return <div className={cn("flex items-center justify-center h-full", className)}>Loading...</div>;
  }

  if (totalWords === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full",
          className
        )}
      >
        <p className="text-muted-foreground">No content to display</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full space-y-6 p-8 overflow-hidden",
        className
      )}
    >
      {/* Word display - large, centered */}
      <div className="flex items-center justify-center min-h-[200px] px-8">
        <span className="text-4xl md:text-5xl lg:text-6xl font-medium text-foreground text-center break-words max-w-3xl">
          {currentWord}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => skip(-10)}
          disabled={currentWordIndex === 0}
          aria-label="Skip backward 10 words"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant={isPlaying ? "default" : "outline"}
          size="sm"
          onClick={togglePlay}
          className="gap-2 min-w-[100px]"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Play
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => skip(10)}
          disabled={currentWordIndex >= totalWords - 1}
          aria-label="Skip forward 10 words"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={stop}
          disabled={currentWordIndex === 0}
          className="text-destructive hover:text-destructive"
          aria-label="Stop and reset"
        >
          <StopCircle className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className={cn(showSettings && "bg-accent")}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Settings panel - always reserve space */}
      <div className="w-full max-w-md">
        <div
          className={cn(
            "rounded-lg border bg-muted/50 p-4 space-y-3 transition-opacity duration-200",
            showSettings ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Speed control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reading Speed</span>
              {isEditingWpm ? (
                <input
                  ref={wpmInputRef}
                  type="number"
                  min="100"
                  max="600"
                  value={wpmInput}
                  onChange={(e) => handleWpmInputChange(e.target.value)}
                  onBlur={handleWpmInputSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleWpmInputSubmit();
                    } else if (e.key === "Escape") {
                      setWpmInput(wpm.toString());
                      setIsEditingWpm(false);
                    }
                  }}
                  className="w-20 px-2 py-1 text-right font-medium border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Enter reading speed"
                />
              ) : (
                <button
                  onClick={handleWpmClick}
                  className="font-medium hover:bg-accent px-2 py-1 rounded transition-colors cursor-pointer"
                  tabIndex={showSettings ? 0 : -1}
                  aria-label="Click to edit reading speed"
                >
                  {wpm} WPM
                </button>
              )}
            </div>
            <input
              type="range"
              min="100"
              max="600"
              step="25"
              value={wpm}
              onChange={(e) => {
                const newWpm = parseInt(e.target.value, 10);
                setWpm(newWpm);
                setWpmInput(newWpm.toString());
                onWpmChange?.(newWpm);
              }}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
              style={{
                background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${((wpm - 100) / 500) * 100}%, var(--muted) ${((wpm - 100) / 500) * 100}%, var(--muted) 100%)`
              }}
              aria-label="Reading speed in words per minute"
              tabIndex={showSettings ? 0 : -1}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Slow (100)</span>
              <span>Normal (250)</span>
              <span>Fast (600)</span>
            </div>
          </div>

          {/* Adaptive speed toggle */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">Adaptive Speed</span>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Slows down for rare or complex words
                </p>
              </div>
              {isLoadingDifficulties ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-label="Analysing text" />
              ) : (
                <button
                  role="switch"
                  aria-checked={adaptiveSpeed}
                  onClick={() => setAdaptiveSpeed((prev) => !prev)}
                  tabIndex={showSettings ? 0 : -1}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    adaptiveSpeed ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                  aria-label="Toggle adaptive speed"
                >
                  <span
                    className={cn(
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                      adaptiveSpeed ? "translate-x-[18px]" : "translate-x-[3px]"
                    )}
                  />
                </button>
              )}
            </div>
            {isLoadingDifficulties && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 rounded-full bg-primary animate-loading-bar" />
              </div>
            )}
          </div>

          {/* Help text */}
          <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Keyboard shortcuts:</strong>
            </p>
            <ul className="space-y-0.5 ml-4">
              <li>• Space: Play/Pause</li>
              <li>• Arrow keys: Move one word</li>
              <li>• Escape: Stop</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
