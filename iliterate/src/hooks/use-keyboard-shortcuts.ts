"use client";

import { useEffect } from "react";

interface KeyboardShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutMap,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const handler = shortcuts[e.key] || shortcuts[e.code];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}
