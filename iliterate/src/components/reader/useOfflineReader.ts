"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Content, Highlight, TranslationLookup } from "@/types/database";
import { offlineStore, useOnlineStatus } from "@/lib/offline-store";
import { toast } from "sonner";

interface UseOfflineReaderOptions {
  contentId: string;
}

interface UseOfflineReaderReturn {
  content: Content | null;
  highlights: Highlight[];
  lookups: TranslationLookup[];
  isLoading: boolean;
  isOffline: boolean;
  pendingActions: number;
  saveHighlightOffline: (highlight: Omit<Highlight, "id" | "created_at" | "updated_at">) => Promise<void>;
  saveTranslationOffline: (lookup: Omit<TranslationLookup, "id" | "created_at">) => Promise<void>;
  syncPendingActions: () => Promise<void>;
}

export function useOfflineReader({ contentId }: UseOfflineReaderOptions): UseOfflineReaderReturn {
  const isOnline = useOnlineStatus();
  const [content, setContent] = useState<Content | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [lookups, setLookups] = useState<TranslationLookup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState(0);
  const syncInProgress = useRef(false);

  // Initialize offline store
  useEffect(() => {
    offlineStore.init();
  }, []);

  // Load content with offline fallback
  const loadContent = useCallback(async () => {
    setIsLoading(true);
    
    try {
      if (isOnline) {
        // Try to fetch from server
        const response = await fetch(`/api/content/${contentId}`);
        if (response.ok) {
          const data = await response.json();
          setContent(data);
          // Cache for offline use
          await offlineStore.cacheContent(data);
        } else {
          throw new Error("Failed to fetch content");
        }
      } else {
        // Use cached content
        const cached = await offlineStore.getCachedContent(contentId);
        if (cached) {
          setContent(cached);
          toast.info("Using cached content (offline mode)");
        } else {
          toast.error("Content not available offline");
        }
      }
    } catch (error) {
      console.error("Load content error:", error);
      // Fallback to cache
      const cached = await offlineStore.getCachedContent(contentId);
      if (cached) {
        setContent(cached);
      }
    } finally {
      setIsLoading(false);
    }
  }, [contentId, isOnline]);

  // Load highlights with offline fallback
  const loadHighlights = useCallback(async () => {
    try {
      if (isOnline) {
        const response = await fetch(`/api/highlights?contentId=${contentId}`);
        if (response.ok) {
          const data = await response.json();
          setHighlights(data);
          // Cache each highlight
          for (const highlight of data) {
            await offlineStore.cacheHighlight(highlight, true);
          }
        }
      } else {
        // Use cached highlights
        const cached = await offlineStore.getCachedHighlights(contentId);
        setHighlights(cached);
      }
    } catch (error) {
      console.error("Load highlights error:", error);
      const cached = await offlineStore.getCachedHighlights(contentId);
      setHighlights(cached);
    }
  }, [contentId, isOnline]);

  // Load translations with offline fallback
  const loadLookups = useCallback(async () => {
    try {
      if (isOnline) {
        const response = await fetch(`/api/translation-lookups?contentId=${contentId}`);
        if (response.ok) {
          const data = await response.json();
          setLookups(data);
          // Cache lookups
          for (const lookup of data) {
            await offlineStore.cacheTranslation(lookup);
          }
        }
      } else {
        // Use cached lookups
        const cached = await offlineStore.getCachedTranslations(contentId);
        setLookups(cached);
      }
    } catch (error) {
      console.error("Load lookups error:", error);
      const cached = await offlineStore.getCachedTranslations(contentId);
      setLookups(cached);
    }
  }, [contentId, isOnline]);

  // Save highlight with offline support
  const saveHighlightOffline = useCallback(async (
    highlight: Omit<Highlight, "id" | "created_at" | "updated_at">
  ) => {
    // Generate temporary ID
    const tempId = `temp-${Date.now()}`;
    const newHighlight: Highlight = {
      ...highlight,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add to local state
    setHighlights((prev) => [...prev, newHighlight]);

    if (isOnline) {
      try {
        const response = await fetch("/api/highlights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentId: highlight.content_id,
            positionType: highlight.position_type,
            startPosition: highlight.start_position,
            endPosition: highlight.end_position,
            selectedText: highlight.selected_text,
            contextBefore: highlight.context_before,
            contextAfter: highlight.context_after,
            note: highlight.note,
            translation: highlight.translation,
            transliteration: highlight.transliteration,
            partOfSpeech: highlight.part_of_speech,
          }),
        });

        if (response.ok) {
          const saved = await response.json();
          // Replace temp highlight with server version
          setHighlights((prev) =>
            prev.map((h) => (h.id === tempId ? saved : h))
          );
          await offlineStore.cacheHighlight(saved, true);
        }
      } catch (error) {
        console.error("Save highlight error:", error);
        // Queue for later sync
        await offlineStore.addPendingAction("highlight", highlight);
        await offlineStore.cacheHighlight(newHighlight, false);
        setPendingActions((p) => p + 1);
      }
    } else {
      // Offline: queue for sync
      await offlineStore.addPendingAction("highlight", highlight);
      await offlineStore.cacheHighlight(newHighlight, false);
      setPendingActions((p) => p + 1);
      toast.info("Highlight saved offline. Will sync when online.");
    }
  }, [isOnline]);

  // Save translation with offline support
  const saveTranslationOffline = useCallback(async (
    lookup: Omit<TranslationLookup, "id" | "created_at">
  ) => {
    const tempId = `temp-${Date.now()}`;
    const newLookup: TranslationLookup = {
      ...lookup,
      id: tempId,
      created_at: new Date().toISOString(),
    };

    // Add to local state
    setLookups((prev) => [newLookup, ...prev]);

    if (isOnline) {
      // Translation is saved automatically by the translate API
      await offlineStore.cacheTranslation(newLookup);
    } else {
      // Offline: cache and queue
      await offlineStore.cacheTranslation(newLookup);
      toast.info("Translation saved offline.");
    }
  }, [isOnline]);

  // Sync pending actions when coming back online
  const syncPendingActions = useCallback(async () => {
    if (!isOnline || syncInProgress.current) return;
    
    syncInProgress.current = true;
    const pending = await offlineStore.getPendingActions();
    
    if (pending.length === 0) {
      syncInProgress.current = false;
      return;
    }

    toast.info(`Syncing ${pending.length} pending actions...`);
    let successCount = 0;

    for (const action of pending) {
      try {
        if (action.type === "highlight") {
          const payload = action.payload as Omit<Highlight, "id" | "created_at" | "updated_at">;
          const response = await fetch("/api/highlights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contentId: payload.content_id,
              positionType: payload.position_type,
              startPosition: payload.start_position,
              endPosition: payload.end_position,
              selectedText: payload.selected_text,
              contextBefore: payload.context_before,
              contextAfter: payload.context_after,
              note: payload.note,
              translation: payload.translation,
              transliteration: payload.transliteration,
              partOfSpeech: payload.part_of_speech,
            }),
          });

          if (response.ok) {
            await offlineStore.removePendingAction(action.id);
            successCount++;
          }
        }
      } catch (error) {
        console.error("Sync action failed:", error);
      }
    }

    setPendingActions((prev) => prev - successCount);
    syncInProgress.current = false;

    if (successCount > 0) {
      toast.success(`Synced ${successCount} actions`);
      // Reload highlights to get server IDs
      await loadHighlights();
    }
  }, [isOnline, loadHighlights]);

  // Initial load
  useEffect(() => {
    loadContent();
    loadHighlights();
    loadLookups();
  }, [loadContent, loadHighlights, loadLookups]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncPendingActions();
    }
  }, [isOnline, syncPendingActions]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      toast.success("Back online! Syncing...");
      syncPendingActions();
    };

    const handleOffline = () => {
      toast.warning("You are offline. Changes will be saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPendingActions]);

  return {
    content,
    highlights,
    lookups,
    isLoading,
    isOffline: !isOnline,
    pendingActions,
    saveHighlightOffline,
    saveTranslationOffline,
    syncPendingActions,
  };
}
