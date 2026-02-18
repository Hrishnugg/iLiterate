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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RSVPReaderProps {
  text: string;
  initialPosition?: number;
  onPositionChange?: (index: number, totalWords: number) => void;
  onWpmChange?: (wpm: number) => void;
  onRegisterSeek?: (seekFn: (percentage: number) => void) => void;
  className?: string;
}

export function RSVPReader({
  text,
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wpmInputRef = useRef<HTMLInputElement>(null);

  // Extract words from text
  const words = useMemo(() => {
    // Remove HTML tags
    const plainText = text.replace(/<[^>]*>/g, " ");

    // Split by whitespace and filter empty strings
    const extractedWords = plainText
      .split(/\s+/)
      .filter((word) => word.trim().length > 0);

    return extractedWords;
  }, [text]);

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

  // Calculate milliseconds per word
  const msPerWord = useMemo(() => {
    return (60 / wpm) * 1000;
  }, [wpm]);

  // Clear interval
  const clearPlayback = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Stop and reset
  const stop = useCallback(() => {
    clearPlayback();
    setIsPlaying(false);
    setCurrentWordIndex(0);
    setTimeout(() => onPositionChange?.(0, totalWords), 0);
  }, [onPositionChange, clearPlayback, totalWords]);

  // Skip forward/backward
  const skip = useCallback(
    (words: number) => {
      setCurrentWordIndex((prev) => {
        const next = Math.max(0, Math.min(totalWords - 1, prev + words));
        // Defer the callback to avoid render-phase update
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

  // Interval effect for word advancement
  useEffect(() => {
    if (isPlaying) {
      // Start playing from the beginning if at the end
      if (currentWordIndex >= totalWords - 1) {
        setCurrentWordIndex(0);
        setTimeout(() => onPositionChange?.(0, totalWords), 0);
      }

      intervalRef.current = setInterval(() => {
        setCurrentWordIndex((prev) => {
          const next = prev + 1;
          if (next >= totalWords) {
            // Stop at the end
            clearPlayback();
            setIsPlaying(false);
            return prev; // Stay at last word
          }
          // Defer the callback to avoid render-phase update
          setTimeout(() => onPositionChange?.(next, totalWords), 0);
          return next;
        });
      }, msPerWord);
    } else {
      clearPlayback();
    }

    return () => {
      clearPlayback();
    };
  }, [isPlaying, msPerWord, totalWords, onPositionChange, clearPlayback]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for play/pause
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
      // Escape to stop (could be used to exit RSVP mode in parent)
      if (e.code === "Escape") {
        stop();
      }
      // Arrow keys for single word navigation
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
      // Reset to current WPM if invalid
      setWpmInput(wpm.toString());
    }
    setIsEditingWpm(false);
  };

  // Start editing WPM
  const handleWpmClick = () => {
    setIsEditingWpm(true);
    setWpmInput(wpm.toString());
  };

  // Notify parent when component mounts (deferred to avoid render-phase update)
  useEffect(() => {
    if (totalWords > 0 && onPositionChange) {
      // Use setTimeout to defer the callback until after render completes
      const timeoutId = setTimeout(() => {
        onPositionChange(currentWordIndex, totalWords);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWords]); // Only run when totalWords changes (on mount)

  // Notify parent of initial WPM
  useEffect(() => {
    if (onWpmChange) {
      const timeoutId = setTimeout(() => {
        onWpmChange(wpm);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Register seek function with parent on mount
  useEffect(() => {
    if (onRegisterSeek) {
      onRegisterSeek(seekToPercentage);
    }
  }, [onRegisterSeek, seekToPercentage]);

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
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
              style={{
                background: `linear-gradient(to right, black 0%, black ${((wpm - 100) / 500) * 100}%, rgb(229 231 235) ${((wpm - 100) / 500) * 100}%, rgb(229 231 235) 100%)`
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
