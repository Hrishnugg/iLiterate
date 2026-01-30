"use client";

import { Content, Highlight, TranslationLookup } from "@/types/database";

const DB_NAME = "iliterate-reader-db";
const DB_VERSION = 1;

interface CachedContent extends Content {
  cachedAt: string;
}

interface CachedTranslation extends TranslationLookup {
  cachedAt: string;
}

interface CachedHighlight extends Highlight {
  cachedAt: string;
  synced: boolean;
}

interface PendingAction {
  id: string;
  type: "translate" | "highlight" | "lookup";
  payload: unknown;
  createdAt: string;
}

class OfflineStore {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Content store
        if (!db.objectStoreNames.contains("content")) {
          const contentStore = db.createObjectStore("content", { keyPath: "id" });
          contentStore.createIndex("cachedAt", "cachedAt", { unique: false });
        }

        // Translations store
        if (!db.objectStoreNames.contains("translations")) {
          const transStore = db.createObjectStore("translations", { keyPath: "id" });
          transStore.createIndex("contentId", "content_id", { unique: false });
          transStore.createIndex("cachedAt", "cachedAt", { unique: false });
        }

        // Highlights store
        if (!db.objectStoreNames.contains("highlights")) {
          const highlightStore = db.createObjectStore("highlights", { keyPath: "id" });
          highlightStore.createIndex("contentId", "content_id", { unique: false });
          highlightStore.createIndex("synced", "synced", { unique: false });
        }

        // Pending actions store
        if (!db.objectStoreNames.contains("pendingActions")) {
          const actionStore = db.createObjectStore("pendingActions", { keyPath: "id" });
          actionStore.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
    });
  }

  // Content methods
  async cacheContent(content: Content): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const cached: CachedContent = {
      ...content,
      cachedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["content"], "readwrite");
      const store = transaction.objectStore("content");
      const request = store.put(cached);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedContent(contentId: string): Promise<Content | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["content"], "readonly");
      const store = transaction.objectStore("content");
      const request = store.get(contentId);

      request.onsuccess = () => {
        const result = request.result as CachedContent | undefined;
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Translation cache methods
  async cacheTranslation(translation: TranslationLookup): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const cached: CachedTranslation = {
      ...translation,
      cachedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["translations"], "readwrite");
      const store = transaction.objectStore("translations");
      const request = store.put(cached);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedTranslations(contentId: string): Promise<TranslationLookup[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["translations"], "readonly");
      const store = transaction.objectStore("translations");
      const index = store.index("contentId");
      const request = index.getAll(contentId);

      request.onsuccess = () => {
        const results = (request.result as CachedTranslation[]).map(
          ({ cachedAt, ...rest }) => rest
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Highlight cache methods
  async cacheHighlight(highlight: Highlight, synced = true): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const cached: CachedHighlight = {
      ...highlight,
      cachedAt: new Date().toISOString(),
      synced,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["highlights"], "readwrite");
      const store = transaction.objectStore("highlights");
      const request = store.put(cached);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedHighlights(contentId: string): Promise<Highlight[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["highlights"], "readonly");
      const store = transaction.objectStore("highlights");
      const index = store.index("contentId");
      const request = index.getAll(contentId);

      request.onsuccess = () => {
        const results = (request.result as CachedHighlight[]).map(
          ({ cachedAt, synced, ...rest }) => rest
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Pending actions for sync
  async addPendingAction(type: PendingAction["type"], payload: unknown): Promise<string> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const action: PendingAction = {
      id,
      type,
      payload,
      createdAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["pendingActions"], "readwrite");
      const store = transaction.objectStore("pendingActions");
      const request = store.put(action);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingActions(): Promise<PendingAction[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["pendingActions"], "readonly");
      const store = transaction.objectStore("pendingActions");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as PendingAction[]);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingAction(id: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["pendingActions"], "readwrite");
      const store = transaction.objectStore("pendingActions");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear old cache (call periodically)
  async clearOldCache(maxAgeDays = 30): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    const stores = ["content", "translations", "highlights"];

    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const index = store.index("cachedAt");
      const range = IDBKeyRange.upperBound(cutoff.toISOString());

      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    }
  }
}

// Singleton instance
export const offlineStore = new OfflineStore();

// Hook for online status
export function useOnlineStatus(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}
