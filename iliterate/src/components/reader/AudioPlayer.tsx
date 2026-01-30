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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  text: string;
  language: string;
  className?: string;
}

interface SpeechSettings {
  rate: number; // 0.1 to 10
  pitch: number; // 0 to 2
  volume: number; // 0 to 1
}

export function AudioPlayer({ text, language, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SpeechSettings>({
    rate: 1,
    pitch: 1,
    volume: 1,
  });
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check if speech synthesis is supported
  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Get voices for the language
  const getVoice = useCallback(() => {
    if (!isSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    
    // Try to find a voice matching the language
    const langVoice = voices.find(
      (v) => v.lang.toLowerCase().startsWith(language.toLowerCase())
    );
    
    // Fallback to any voice
    return langVoice || voices[0];
  }, [language, isSupported]);

  // Stop any ongoing speech
  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentCharIndex(0);
  }, [isSupported]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    if (!isSupported) return;

    if (isPlaying) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      // Start new playback
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = getVoice();
      
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.lang = language;
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentCharIndex(0);
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      utterance.onboundary = (event) => {
        setCurrentCharIndex(event.charIndex);
      };

      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event);
        setIsPlaying(false);
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, [isPlaying, isPaused, text, language, settings, getVoice, isSupported]);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    if (!isSupported || !isPlaying) return;
    
    // Cancel current and restart from new position (approximate)
    window.speechSynthesis.cancel();
    
    // Estimate characters per second based on rate
    const charsPerSecond = 15 * settings.rate;
    const charOffset = Math.floor(seconds * charsPerSecond);
    const newIndex = Math.max(0, Math.min(text.length - 1, currentCharIndex + charOffset));
    
    setCurrentCharIndex(newIndex);
    
    // Create new utterance from new position
    const remainingText = text.slice(newIndex);
    const utterance = new SpeechSynthesisUtterance(remainingText);
    const voice = getVoice();
    
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.lang = language;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentCharIndex(0);
    };

    window.speechSynthesis.speak(utterance);
  }, [isPlaying, currentCharIndex, text, language, settings, getVoice, isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  if (!isSupported) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Audio playback not supported in this browser.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => skip(-10)}
          disabled={!isPlaying}
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant={isPlaying && !isPaused ? "default" : "outline"}
          size="sm"
          onClick={togglePlay}
          className="gap-2"
        >
          {isPlaying && !isPaused ? (
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
          disabled={!isPlaying}
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        {isPlaying && (
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
                // Restart with new rate if playing
                if (isPlaying) {
                  stop();
                  setTimeout(() => togglePlay(), 100);
                }
              }}
              className="w-full"
            />
          </div>

          {/* Pitch control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pitch</span>
              <span>{settings.pitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={settings.pitch}
              onChange={(e) => {
                const newPitch = parseFloat(e.target.value);
                setSettings((s) => ({ ...s, pitch: newPitch }));
                if (isPlaying) {
                  stop();
                  setTimeout(() => togglePlay(), 100);
                }
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
        </div>
      )}

      {/* Progress indicator */}
      {isPlaying && (
        <div className="text-xs text-muted-foreground">
          Reading: {Math.round((currentCharIndex / text.length) * 100)}%
        </div>
      )}
    </div>
  );
}
