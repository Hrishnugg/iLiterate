"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface ReadingProgress {
  progress: number; // 0-100
  currentPosition: number; // scroll position in pixels
  totalHeight: number;
  wordsRead: number;
}

interface UseReadingProgressOptions {
  contentId: string;
  wordCount: number;
  onProgressUpdate?: (progress: number) => void;
  saveInterval?: number; // ms, default 5000
}

export function useReadingProgress({
  contentId,
  wordCount,
  onProgressUpdate,
  saveInterval = 5000,
}: UseReadingProgressOptions) {
  const [progress, setProgress] = useState<ReadingProgress>({
    progress: 0,
    currentPosition: 0,
    totalHeight: 0,
    wordsRead: 0,
  });

  const lastSavedRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  // Calculate reading progress
  const calculateProgress = useCallback((): ReadingProgress => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    // Calculate percentage (capped at 100)
    const percentage = docHeight > 0 
      ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100))
      : 100;

    // Estimate words read based on scroll position
    const wordsRead = Math.round((percentage / 100) * wordCount);

    return {
      progress: Math.round(percentage),
      currentPosition: scrollTop,
      totalHeight: docHeight,
      wordsRead,
    };
  }, [wordCount]);

  // Update progress on scroll
  const handleScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const newProgress = calculateProgress();
      setProgress(newProgress);
      onProgressUpdate?.(newProgress.progress);
    });
  }, [calculateProgress, onProgressUpdate]);

  // Save progress to server
  const saveProgress = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Only save if enough time has passed or forced
    if (!force && now - lastSavedRef.current < saveInterval) {
      return;
    }

    lastSavedRef.current = now;

    try {
      await fetch("/api/reading-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          progress: progress.progress,
          position: progress.currentPosition,
          wordsRead: progress.wordsRead,
        }),
      });
    } catch (error) {
      console.error("Failed to save reading progress:", error);
    }
  }, [contentId, progress, saveInterval]);

  // Load initial progress
  const loadProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/reading-progress?contentId=${contentId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.last_position) {
          // Restore scroll position (slightly above to give context)
          window.scrollTo({
            top: Math.max(0, data.last_position - 100),
            behavior: "smooth",
          });
        }
      }
    } catch (error) {
      console.error("Failed to load reading progress:", error);
    }
  }, [contentId]);

  // Set up scroll listener
  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    loadProgress(); // Restore position

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleScroll, loadProgress]);

  // Auto-save progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveProgress();
    }, saveInterval);

    // Save on page unload
    const handleBeforeUnload = () => {
      saveProgress(true);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveProgress, saveInterval]);

  // Format time remaining
  const getTimeRemaining = useCallback((wpm = 200): string => {
    const wordsRemaining = wordCount - progress.wordsRead;
    const minutes = Math.ceil(wordsRemaining / wpm);
    
    if (minutes < 1) return "< 1 min";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }, [progress.wordsRead, wordCount]);

  return {
    ...progress,
    getTimeRemaining,
    saveProgress: () => saveProgress(true),
  };
}
