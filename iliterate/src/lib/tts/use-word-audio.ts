"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Module-level cache shared across all hook instances so navigating
 * between cards doesn't re-fetch audio for the same word.
 * Keys are "word\tlanguage", values are blob URLs.
 */
const audioCache = new Map<string, string>();

function cacheKey(word: string, language: string) {
  return `${word}\t${language}`;
}

export function useWordAudio() {
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(async (word: string, language: string) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const key = cacheKey(word, language);
    let blobUrl = audioCache.get(key);

    if (!blobUrl) {
      setLoading(true);
      try {
        const res = await fetch("/api/tts/word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: word, language }),
        });

        if (!res.ok) {
          console.error("Word TTS failed:", res.status);
          setLoading(false);
          return;
        }

        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        audioCache.set(key, blobUrl);
      } catch (err) {
        console.error("Word TTS error:", err);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    const audio = new Audio(blobUrl);
    audioRef.current = audio;
    audio.play().catch((err) => console.error("Playback error:", err));
  }, []);

  return { play, loading };
}
