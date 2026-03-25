"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  History,
  Library,
  Link2,
  ListMusic,
  Loader2,
  Music4,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatKaraokeProvider,
  getKaraokePolicyCopy,
  initializeAppleMusicClient,
} from "@/lib/karaoke/client";
import { ProviderStatus } from "@/lib/karaoke/providers";
import {
  ActiveKaraokeSession,
  KaraokeItemSummary,
  KaraokeMusicProvider,
  KaraokeSetlist,
  KaraokeTrackLink,
  ProviderCollectionKind,
  ProviderLibraryCollection,
  ProviderLibraryItem,
  ProviderPlaylistSummary,
} from "@/types/database";

interface KaraokeCollectionClientProps {
  initialSetlists: KaraokeSetlist[];
}

type PlaylistPanel = {
  playlist: ProviderPlaylistSummary | null;
  items: ProviderLibraryItem[];
  cursor: string | null;
};

const PROVIDERS: KaraokeMusicProvider[] = [
  "soundcloud",
  "apple_music",
  "spotify",
];

const STATUS_COPY: Record<KaraokeItemSummary["status"], string> = {
  matching: "Matching lyrics",
  ready: "Ready",
  needs_review: "Needs review",
  manual_fallback: "Needs manual lyrics",
  error: "Error",
};

const COLLECTION_ICONS: Record<ProviderCollectionKind, typeof Library> = {
  tracks: Library,
  playlists: ListMusic,
  recents: History,
};

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) {
    return "Unknown";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getStatusTone(status: KaraokeItemSummary["status"]) {
  if (status === "ready") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  }

  if (status === "needs_review") {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  if (status === "manual_fallback") {
    return "border-rose-300/25 bg-rose-300/10 text-rose-100";
  }

  if (status === "error") {
    return "border-red-400/25 bg-red-400/10 text-red-100";
  }

  return "border-white/10 bg-white/[0.06] text-white/70";
}

function sortSetlists(setlists: KaraokeSetlist[]) {
  return [...setlists].sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1;
    }

    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function KaraokeCollectionClient({
  initialSetlists,
}: KaraokeCollectionClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [setlists, setSetlists] = useState(() => sortSetlists(initialSetlists));
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [activeProvider, setActiveProvider] =
    useState<KaraokeMusicProvider>("apple_music");
  const [collectionsByProvider, setCollectionsByProvider] = useState<
    Partial<Record<KaraokeMusicProvider, ProviderLibraryCollection[]>>
  >({});
  const [playlistPanels, setPlaylistPanels] = useState<Record<string, PlaylistPanel>>(
    {}
  );
  const [selectedPlaylistKey, setSelectedPlaylistKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KaraokeTrackLink[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [newSetlistName, setNewSetlistName] = useState("");
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(
    initialSetlists.find((setlist) => setlist.isDefault)?.id ??
      initialSetlists[0]?.id ??
      null
  );
  const [session, setSession] = useState<ActiveKaraokeSession>({
    setlistId:
      initialSetlists.find((setlist) => setlist.isDefault)?.id ??
      initialSetlists[0]?.id ??
      null,
    currentItemId: initialSetlists[0]?.items[0]?.karaokeItemId ?? null,
    queueItemIds: initialSetlists[0]?.items.map((item) => item.karaokeItemId) ?? [],
    currentIndex: 0,
  });
  const [providerAction, setProviderAction] = useState<string | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const activeSetlist = useMemo(
    () => setlists.find((setlist) => setlist.id === activeSetlistId) ?? null,
    [activeSetlistId, setlists]
  );

  const allItems = useMemo(() => {
    const unique = new Map<string, KaraokeItemSummary>();
    for (const setlist of setlists) {
      for (const item of setlist.items) {
        if (item.item) {
          unique.set(item.item.id, item.item);
        }
      }
    }
    return Array.from(unique.values());
  }, [setlists]);

  const currentSessionItem = useMemo(() => {
    if (!session.currentItemId) {
      return activeSetlist?.items[0] ?? null;
    }

    return (
      activeSetlist?.items.find((item) => item.karaokeItemId === session.currentItemId) ??
      activeSetlist?.items[0] ??
      null
    );
  }, [activeSetlist, session.currentItemId]);

  const selectedPlaylistPanel = selectedPlaylistKey
    ? playlistPanels[selectedPlaylistKey] ?? null
    : null;

  const connectedProviderCount = useMemo(
    () => providerStatuses.filter((status) => status.connected).length,
    [providerStatuses]
  );
  const readyCount = useMemo(
    () => allItems.filter((item) => item.status === "ready").length,
    [allItems]
  );

  const syncSessionWithSetlist = useCallback((setlist: KaraokeSetlist | null) => {
    setSession((current) => {
      const queueItemIds = setlist?.items.map((item) => item.karaokeItemId) ?? [];
      const currentIndex = current.currentItemId
        ? Math.max(queueItemIds.indexOf(current.currentItemId), 0)
        : 0;
      return {
        setlistId: setlist?.id ?? null,
        currentItemId: queueItemIds[currentIndex] ?? null,
        queueItemIds,
        currentIndex: queueItemIds.length === 0 ? 0 : currentIndex,
      };
    });
  }, []);

  const mergeSetlist = useCallback((nextSetlist: KaraokeSetlist | null | undefined) => {
    if (!nextSetlist) {
      return;
    }

    setSetlists((current) => {
      const without = current.filter((setlist) => setlist.id !== nextSetlist.id);
      return sortSetlists([...without, nextSetlist]);
    });

    setActiveSetlistId((current) => current ?? nextSetlist.id);
    syncSessionWithSetlist(nextSetlist);
  }, [syncSessionWithSetlist]);

  const loadProviderStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/karaoke/providers");
      if (!response.ok) {
        throw new Error("Failed to load provider connections");
      }

      const payload = (await response.json()) as { providers?: ProviderStatus[] };
      const providers = Array.isArray(payload.providers) ? payload.providers : [];
      setProviderStatuses(providers);

      const recommendedProvider =
        providers.find((status) => status.connected)?.provider ??
        providers.find((status) => status.configured)?.provider ??
        "apple_music";
      setActiveProvider((current) => current || recommendedProvider);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load provider connections";
      toast.error(message);
    }
  }, []);

  const loadSetlists = useCallback(async () => {
    try {
      const response = await fetch("/api/karaoke/setlists");
      if (!response.ok) {
        throw new Error("Failed to load karaoke setlists");
      }

      const payload = (await response.json()) as { setlists?: KaraokeSetlist[] };
      const nextSetlists = sortSetlists(
        Array.isArray(payload.setlists) ? payload.setlists : []
      );
      setSetlists(nextSetlists);

      const nextActiveSetlist =
        nextSetlists.find((setlist) => setlist.id === activeSetlistId) ??
        nextSetlists.find((setlist) => setlist.isDefault) ??
        nextSetlists[0] ??
        null;
      setActiveSetlistId(nextActiveSetlist?.id ?? null);
      syncSessionWithSetlist(nextActiveSetlist);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load karaoke setlists";
      toast.error(message);
    }
  }, [activeSetlistId, syncSessionWithSetlist]);

  const loadLibrary = useCallback(async (provider: KaraokeMusicProvider) => {
    setLoadingLibrary(true);
    try {
      const response = await fetch(`/api/karaoke/providers/${provider}/library`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to load provider library");
      }

      const payload = (await response.json()) as {
        collections?: ProviderLibraryCollection[];
      };
      setCollectionsByProvider((current) => ({
        ...current,
        [provider]: Array.isArray(payload.collections) ? payload.collections : [],
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load provider library";
      toast.error(message);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  const loadPlaylistPanel = useCallback(
    async (provider: KaraokeMusicProvider, playlistId: string) => {
      const key = `${provider}:${playlistId}`;
      setBusyKey(`playlist:${key}`);
      try {
        const response = await fetch(
          `/api/karaoke/providers/${provider}/playlists/${playlistId}`
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Failed to load playlist");
        }

        const payload = (await response.json()) as PlaylistPanel;
        setPlaylistPanels((current) => ({ ...current, [key]: payload }));
        setSelectedPlaylistKey(key);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load playlist";
        toast.error(message);
      } finally {
        setBusyKey(null);
      }
    },
    []
  );

  const loadMoreCollection = useCallback(
    async (collection: ProviderLibraryCollection) => {
      if (!collection.cursor) {
        return;
      }

      setBusyKey(`collection:${collection.provider}:${collection.key}`);
      try {
        const response = await fetch(
          `/api/karaoke/providers/${collection.provider}/collections/${collection.key}?cursor=${encodeURIComponent(
            collection.cursor
          )}`
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Failed to load more tracks");
        }

        const payload = (await response.json()) as { collection?: ProviderLibraryCollection };
        const nextCollection = payload.collection;
        if (!nextCollection) {
          return;
        }

        setCollectionsByProvider((current) => {
          const currentCollections = current[collection.provider] ?? [];
          return {
            ...current,
            [collection.provider]: currentCollections.map((entry) =>
              entry.key === collection.key
                ? {
                    ...nextCollection,
                    items: [...entry.items, ...nextCollection.items],
                  }
                : entry
            ),
          };
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load more collection items";
        toast.error(message);
      } finally {
        setBusyKey(null);
      }
    },
    []
  );

  const runSearch = useCallback(
    async (provider: KaraokeMusicProvider, query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const response = await fetch(
          `/api/karaoke/providers/${provider}/search?q=${encodeURIComponent(trimmed)}`
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Failed to search provider");
        }

        const payload = (await response.json()) as { tracks?: KaraokeTrackLink[] };
        setSearchResults(Array.isArray(payload.tracks) ? payload.tracks : []);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to search provider";
        toast.error(message);
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const addTrackToSetlist = useCallback(
    async (track: KaraokeTrackLink) => {
      if (!activeSetlistId) {
        toast.error("No active setlist is available yet.");
        return;
      }

      setBusyKey(`track:${track.providerTrackId}`);
      try {
        const response = await fetch(`/api/karaoke/setlists/${activeSetlistId}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            track,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Failed to add track to setlist");
        }

        const payload = (await response.json()) as { setlist?: KaraokeSetlist };
        mergeSetlist(payload.setlist);
        toast.success("Added to setlist");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to add track to setlist";
        toast.error(message);
      } finally {
        setBusyKey(null);
      }
    },
    [activeSetlistId, mergeSetlist]
  );

  const addPlaylistToSetlist = useCallback(async () => {
    if (!activeSetlistId || !selectedPlaylistKey || !selectedPlaylistPanel) {
      return;
    }

    const provider = selectedPlaylistKey.split(":")[0] as KaraokeMusicProvider;
    const playlist = selectedPlaylistPanel.playlist;
    const tracks = selectedPlaylistPanel.items
      .map((item) => item.track)
      .filter((track): track is KaraokeTrackLink => Boolean(track));

    if (tracks.length === 0) {
      toast.error("This playlist does not contain importable tracks yet.");
      return;
    }

    setBusyKey(`playlist-import:${selectedPlaylistKey}`);
    try {
      const response = await fetch(`/api/karaoke/setlists/${activeSetlistId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tracks,
          playlist: playlist
            ? {
                provider,
                playlistId: playlist.playlistId,
                title: playlist.title,
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to import playlist");
      }

      const payload = (await response.json()) as { setlist?: KaraokeSetlist };
      mergeSetlist(payload.setlist);
      toast.success("Playlist added to setlist");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import playlist";
      toast.error(message);
    } finally {
      setBusyKey(null);
    }
  }, [activeSetlistId, mergeSetlist, selectedPlaylistKey, selectedPlaylistPanel]);

  const importViaUrl = useCallback(async () => {
    if (!activeSetlistId) {
      toast.error("No active setlist is available yet.");
      return;
    }

    const trimmed = urlInput.trim();
    if (!trimmed) {
      toast.error("Paste a track URL to import.");
      return;
    }

    setBusyKey("url-import");
    try {
      const response = await fetch(`/api/karaoke/setlists/${activeSetlistId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to import track");
      }

      const payload = (await response.json()) as { setlist?: KaraokeSetlist };
      mergeSetlist(payload.setlist);
      setUrlInput("");
      toast.success("Track imported");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import track";
      toast.error(message);
    } finally {
      setBusyKey(null);
    }
  }, [activeSetlistId, mergeSetlist, urlInput]);

  const createSetlist = useCallback(async () => {
    const trimmed = newSetlistName.trim();
    if (!trimmed) {
      toast.error("Name the setlist first.");
      return;
    }

    setBusyKey("create-setlist");
    try {
      const response = await fetch("/api/karaoke/setlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to create setlist");
      }

      const payload = (await response.json()) as { setlist?: KaraokeSetlist };
      if (payload.setlist) {
        setSetlists((current) => sortSetlists([...current, payload.setlist as KaraokeSetlist]));
        setActiveSetlistId(payload.setlist.id);
        syncSessionWithSetlist(payload.setlist);
      }
      setNewSetlistName("");
      toast.success("Setlist created");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create setlist";
      toast.error(message);
    } finally {
      setBusyKey(null);
    }
  }, [newSetlistName, syncSessionWithSetlist]);

  const removeSetlistItem = useCallback(
    async (setlistItemId: string) => {
      if (!activeSetlistId) {
        return;
      }

      setBusyKey(`remove:${setlistItemId}`);
      try {
        const response = await fetch(
          `/api/karaoke/setlists/${activeSetlistId}/items?setlistItemId=${setlistItemId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Failed to remove song");
        }

        const payload = (await response.json()) as { setlist?: KaraokeSetlist };
        mergeSetlist(payload.setlist);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to remove song";
        toast.error(message);
      } finally {
        setBusyKey(null);
      }
    },
    [activeSetlistId, mergeSetlist]
  );

  const moveSetlistItem = useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!activeSetlist) {
        return;
      }

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= activeSetlist.items.length) {
        return;
      }

      const reordered = [...activeSetlist.items];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, moved);
      const itemIds = reordered.map((item) => item.id);

      setBusyKey(`reorder:${activeSetlist.id}`);
      try {
        const response = await fetch(`/api/karaoke/setlists/${activeSetlist.id}/items`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ itemIds }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Failed to reorder setlist");
        }

        const payload = (await response.json()) as { setlist?: KaraokeSetlist };
        mergeSetlist(payload.setlist);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to reorder setlist";
        toast.error(message);
      } finally {
        setBusyKey(null);
      }
    },
    [activeSetlist, mergeSetlist]
  );

  const connectAppleMusic = useCallback(async () => {
    setProviderAction("connect");
    try {
      const instance = await initializeAppleMusicClient();
      const musicUserToken = await instance.authorize();
      const response = await fetch("/api/karaoke/providers/apple_music/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ musicUserToken }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to connect Apple Music");
      }

      await Promise.all([loadProviderStatuses(), loadLibrary("apple_music")]);
      toast.success("Apple Music connected");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect Apple Music";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [loadLibrary, loadProviderStatuses]);

  const startOAuth = useCallback(async (provider: "spotify" | "soundcloud") => {
    setProviderAction("connect");
    try {
      const response = await fetch(
        `/api/karaoke/providers/${provider}/start?returnTo=${encodeURIComponent(pathname || "/karaoke")}`
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `Failed to connect ${provider}`);
      }

      const payload = (await response.json()) as { authorizeUrl: string };
      window.location.assign(payload.authorizeUrl);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to connect ${formatKaraokeProvider(provider)}`;
      toast.error(message);
      setProviderAction(null);
    }
  }, [pathname]);

  const disconnectProvider = useCallback(async (provider: KaraokeMusicProvider) => {
    setProviderAction(`disconnect:${provider}`);
    try {
      const response = await fetch(`/api/karaoke/providers/${provider}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to disconnect provider");
      }

      await Promise.all([loadProviderStatuses(), loadLibrary(provider)]);
      toast.success(`${formatKaraokeProvider(provider)} disconnected`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect provider";
      toast.error(message);
    } finally {
      setProviderAction(null);
    }
  }, [loadLibrary, loadProviderStatuses]);

  useEffect(() => {
    void loadProviderStatuses();
    void loadSetlists();
  }, [loadProviderStatuses, loadSetlists]);

  useEffect(() => {
    if (!collectionsByProvider[activeProvider]) {
      void loadLibrary(activeProvider);
    }
  }, [activeProvider, collectionsByProvider, loadLibrary]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(activeProvider, searchQuery);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [activeProvider, runSearch, searchQuery]);

  useEffect(() => {
    const spotifyState = searchParams.get("karaoke_spotify");
    const soundCloudState = searchParams.get("karaoke_soundcloud");

    if (spotifyState === "connected") {
      toast.success("Spotify connected");
      void Promise.all([loadProviderStatuses(), loadLibrary("spotify")]);
      router.replace("/karaoke");
    } else if (soundCloudState === "connected") {
      toast.success("SoundCloud connected");
      void Promise.all([loadProviderStatuses(), loadLibrary("soundcloud")]);
      router.replace("/karaoke");
    }
  }, [loadLibrary, loadProviderStatuses, router, searchParams]);

  const collections = collectionsByProvider[activeProvider] ?? [];

  return (
    <div className="flex h-full min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,_rgba(21,128,61,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(180,83,9,0.12),_transparent_30%)]">
      <div className="border-b border-white/8 bg-black/20 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 py-5 md:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-emerald-200/65">
                <Music4 className="size-4" />
                Karaoke
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  Browse your music, build a setlist, and rehearse without leaving the app shell.
                </h1>
                <p className="max-w-4xl text-sm leading-6 text-white/65">
                  Provider libraries stay separated, lyrics matching runs in the background,
                  and your internal setlists stay focused on practice instead of import plumbing.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                {connectedProviderCount} connected
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                {allItems.length} songs in workspace
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                {readyCount} rehearsal-ready
              </span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex flex-wrap gap-2">
                  {PROVIDERS.map((provider) => {
                    const status =
                      providerStatuses.find((entry) => entry.provider === provider) ??
                      ({
                        provider,
                        configured: false,
                        connected: false,
                        displayName: formatKaraokeProvider(provider),
                      } satisfies ProviderStatus);
                    const active = provider === activeProvider;

                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => setActiveProvider(provider)}
                        className={cn(
                          "flex min-w-[180px] flex-1 items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors",
                          active
                            ? "border-emerald-400/35 bg-emerald-400/10 text-white"
                            : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                        )}
                      >
                        <div>
                          <div className="text-sm font-medium">{status.displayName}</div>
                          <div className="text-xs text-white/50">
                            {status.connected
                              ? "Library connected"
                              : status.configured
                                ? "Search available"
                                : "Needs configuration"}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium",
                            status.connected
                              ? "bg-emerald-400/15 text-emerald-100"
                              : "bg-white/[0.08] text-white/55"
                          )}
                        >
                          {status.connected ? "Connected" : "Offline"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex h-full flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-white">
                      {formatKaraokeProvider(activeProvider)}
                    </div>
                    <div className="text-xs leading-5 text-white/55">
                      {getKaraokePolicyCopy(activeProvider) ??
                        "Pull your library, inspect playlists, or search for a specific song."}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                      onClick={() => void loadLibrary(activeProvider)}
                    >
                      {loadingLibrary ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Refresh
                    </Button>
                    {activeProvider === "apple_music" && (
                      <Button size="sm" onClick={() => void connectAppleMusic()}>
                        Connect Apple Music
                      </Button>
                    )}
                    {activeProvider === "spotify" && (
                      <Button size="sm" onClick={() => void startOAuth("spotify")}>
                        Connect Spotify
                      </Button>
                    )}
                    {activeProvider === "soundcloud" && (
                      <Button size="sm" onClick={() => void startOAuth("soundcloud")}>
                        Connect SoundCloud
                      </Button>
                    )}
                    {providerStatuses.find((status) => status.provider === activeProvider)
                      ?.connected && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                        onClick={() => void disconnectProvider(activeProvider)}
                      >
                        {providerAction === `disconnect:${activeProvider}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Unlink className="size-4" />
                        )}
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/65">
              <div className="font-medium text-white">Active setlist</div>
              <div className="mt-1">{activeSetlist?.name ?? "Main Setlist"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid h-full w-full max-w-[1600px] gap-6 px-6 py-6 md:px-8 xl:grid-cols-[minmax(0,1.75fr)_380px]">
        <div className="flex min-h-0 flex-col gap-5">
          <section className="rounded-[28px] border border-white/10 bg-black/25 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <Search className="size-4 text-white/45" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={`Search ${formatKaraokeProvider(activeProvider)} by title or artist`}
                  className="border-none bg-transparent px-0 text-white shadow-none focus-visible:ring-0"
                />
                {searching && <Loader2 className="size-4 animate-spin text-white/45" />}
              </label>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder="Paste a track URL as fallback"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
                <Button onClick={() => void importViaUrl()} disabled={busyKey === "url-import"}>
                  {busyKey === "url-import" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                  Import
                </Button>
              </div>
            </div>
          </section>

          {searchQuery.trim().length > 0 ? (
            <section className="rounded-[28px] border border-white/10 bg-black/25 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-white">Search results</h2>
                  <p className="text-sm text-white/55">
                    Add songs directly to your active setlist.
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                {searchResults.length === 0 && !searching && (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                    No results yet. Try another title, artist, or paste a direct URL.
                  </div>
                )}
                {searchResults.map((track) => (
                  <div
                    key={`${track.provider}:${track.providerTrackId}`}
                    className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="size-12 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                        {track.artworkUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={track.artworkUrl}
                            alt={`${track.title} artwork`}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-white/35">
                            <Music4 className="size-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">{track.title}</div>
                        <div className="truncate text-sm text-white/55">{track.artist}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">
                        {formatDuration(track.durationMs)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => void addTrackToSetlist(track)}
                        disabled={busyKey === `track:${track.providerTrackId}`}
                      >
                        {busyKey === `track:${track.providerTrackId}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
              <div className="grid gap-5">
                {collections
                  .filter((collection) => collection.key !== "playlists")
                  .map((collection) => {
                    const Icon = COLLECTION_ICONS[collection.key];
                    return (
                      <section
                        key={collection.key}
                        className="rounded-[28px] border border-white/10 bg-black/25 p-4"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.08] p-2 text-emerald-100">
                              <Icon className="size-4" />
                            </div>
                            <div>
                              <h2 className="text-base font-medium text-white">
                                {collection.label}
                              </h2>
                              <p className="text-sm text-white/50">
                                {collection.description ||
                                  "Import from your provider library into the active setlist."}
                              </p>
                            </div>
                          </div>
                          {collection.cursor && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                              onClick={() => void loadMoreCollection(collection)}
                              disabled={
                                busyKey ===
                                `collection:${collection.provider}:${collection.key}`
                              }
                            >
                              {busyKey ===
                              `collection:${collection.provider}:${collection.key}` ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <RefreshCw className="size-4" />
                              )}
                              Load more
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-2">
                          {collection.items.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                              {collection.emptyMessage || "Nothing to show here yet."}
                            </div>
                          )}
                          {collection.items.map((item) => (
                            <div
                              key={item.id}
                              className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="size-12 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                                  {item.artworkUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.artworkUrl}
                                      alt={`${item.title} artwork`}
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex size-full items-center justify-center text-white/35">
                                      <Music4 className="size-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-white">
                                    {item.title}
                                  </div>
                                  <div className="truncate text-sm text-white/55">
                                    {item.subtitle}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.track && (
                                  <>
                                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">
                                      {formatDuration(item.durationMs)}
                                    </span>
                                    <Button
                                      size="sm"
                                      onClick={() => void addTrackToSetlist(item.track as KaraokeTrackLink)}
                                      disabled={
                                        busyKey ===
                                        `track:${item.track?.providerTrackId ?? item.id}`
                                      }
                                    >
                                      {busyKey ===
                                      `track:${item.track?.providerTrackId ?? item.id}` ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <Plus className="size-4" />
                                      )}
                                      Add
                                    </Button>
                                  </>
                                )}
                                {!item.track && item.playlist && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                                    onClick={() =>
                                      void loadPlaylistPanel(
                                        item.provider,
                                        item.playlist?.playlistId as string
                                      )
                                    }
                                    disabled={
                                      busyKey ===
                                      `playlist:${item.provider}:${item.playlist?.playlistId}`
                                    }
                                  >
                                    {busyKey ===
                                    `playlist:${item.provider}:${item.playlist?.playlistId}` ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <ListMusic className="size-4" />
                                    )}
                                    Open
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
              </div>

              <div className="grid gap-5">
                {collections
                  .filter((collection) => collection.key === "playlists")
                  .map((collection) => (
                    <section
                      key={collection.key}
                      className="rounded-[28px] border border-white/10 bg-black/25 p-4"
                    >
                      <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.08] p-2 text-emerald-100">
                          <ListMusic className="size-4" />
                        </div>
                        <div>
                          <h2 className="text-base font-medium text-white">
                            {collection.label}
                          </h2>
                          <p className="text-sm text-white/50">
                            Pull full playlists into a practice queue without writing back to the provider.
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        {collection.items.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                            {collection.emptyMessage || "No playlists yet."}
                          </div>
                        )}
                        {collection.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              item.playlist &&
                              void loadPlaylistPanel(
                                item.provider,
                                item.playlist.playlistId
                              )
                            }
                            className={cn(
                              "grid gap-3 rounded-2xl border px-4 py-3 text-left transition-colors md:grid-cols-[minmax(0,1fr)_auto]",
                              selectedPlaylistKey ===
                                `${item.provider}:${item.playlist?.playlistId}`
                                ? "border-emerald-400/35 bg-emerald-400/[0.08]"
                                : "border-white/8 bg-white/[0.03] hover:border-white/20"
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="size-12 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                                {item.artworkUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.artworkUrl}
                                    alt={`${item.title} artwork`}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <div className="flex size-full items-center justify-center text-white/35">
                                    <ListMusic className="size-5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-white">{item.title}</div>
                                <div className="truncate text-sm text-white/55">
                                  {item.subtitle}
                                </div>
                              </div>
                            </div>
                            <span className="self-center rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">
                              {item.playlist?.trackCount ?? 0} tracks
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}

                <section className="rounded-[28px] border border-white/10 bg-black/25 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-medium text-white">Playlist detail</h2>
                      <p className="text-sm text-white/50">
                        Open a provider playlist, inspect it, and bulk-add it into the active setlist.
                      </p>
                    </div>
                    {selectedPlaylistPanel?.playlist && (
                      <Button
                        size="sm"
                        onClick={() => void addPlaylistToSetlist()}
                        disabled={busyKey === `playlist-import:${selectedPlaylistKey}`}
                      >
                        {busyKey === `playlist-import:${selectedPlaylistKey}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        Add playlist
                      </Button>
                    )}
                  </div>

                  {!selectedPlaylistPanel && (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-sm text-white/45">
                      Select a provider playlist to inspect its tracks and import it into a setlist.
                    </div>
                  )}

                  {selectedPlaylistPanel && (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <div className="font-medium text-white">
                          {selectedPlaylistPanel.playlist?.title ?? "Playlist"}
                        </div>
                        <div className="mt-1 text-sm text-white/55">
                          {selectedPlaylistPanel.playlist?.curator} ·{" "}
                          {selectedPlaylistPanel.playlist?.trackCount ?? selectedPlaylistPanel.items.length} tracks
                        </div>
                      </div>
                      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                        {selectedPlaylistPanel.items.map((item) => (
                          <div
                            key={item.id}
                            className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-white">{item.title}</div>
                              <div className="truncate text-sm text-white/55">{item.subtitle}</div>
                            </div>
                            {item.track && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                                onClick={() => void addTrackToSetlist(item.track as KaraokeTrackLink)}
                              >
                                <Plus className="size-4" />
                                Add song
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-5">
          <section className="rounded-[28px] border border-white/10 bg-black/25 p-4">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-medium text-white">Setlists</h2>
                <p className="text-sm text-white/50">
                  Internal practice queues stay separate from provider playlists.
                </p>
              </div>
              <Sparkles className="size-4 text-emerald-200/70" />
            </div>
            <div className="flex gap-2">
              <Input
                value={newSetlistName}
                onChange={(event) => setNewSetlistName(event.target.value)}
                placeholder="New setlist name"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
              <Button onClick={() => void createSetlist()} disabled={busyKey === "create-setlist"}>
                {busyKey === "create-setlist" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add
              </Button>
            </div>
            <div className="mt-4 grid gap-2">
              {setlists.map((setlist) => (
                <button
                  key={setlist.id}
                  type="button"
                  onClick={() => {
                    setActiveSetlistId(setlist.id);
                    syncSessionWithSetlist(setlist);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors",
                    setlist.id === activeSetlistId
                      ? "border-emerald-400/35 bg-emerald-400/[0.08]"
                      : "border-white/8 bg-white/[0.03] hover:border-white/20"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{setlist.name}</span>
                      {setlist.isDefault && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-white/50">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-white/55">{setlist.itemCount} songs</div>
                  </div>
                  {setlist.id === activeSetlistId && (
                    <CheckCircle2 className="size-4 text-emerald-200" />
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-white/10 bg-black/25 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-white">
                  {activeSetlist?.name ?? "Active setlist"}
                </h2>
                <p className="text-sm text-white/50">
                  Reorder songs, open the studio, or clean up the queue.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">
                {activeSetlist?.itemCount ?? 0} total
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {activeSetlist?.items.length ? (
                activeSetlist.items.map((setlistItem, index) => {
                  const item = setlistItem.item;
                  const active = session.currentItemId === setlistItem.karaokeItemId;

                  return (
                    <div
                      key={setlistItem.id}
                      className={cn(
                        "rounded-2xl border px-3 py-3 transition-colors",
                        active
                          ? "border-emerald-400/30 bg-emerald-400/[0.08]"
                          : "border-white/8 bg-white/[0.03]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1 pt-0.5">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="text-white/55 hover:text-white"
                            onClick={() => void moveSetlistItem(index, -1)}
                            disabled={index === 0 || busyKey === `reorder:${activeSetlist.id}`}
                          >
                            <ArrowUp className="size-3" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="text-white/55 hover:text-white"
                            onClick={() => void moveSetlistItem(index, 1)}
                            disabled={
                              index === activeSetlist.items.length - 1 ||
                              busyKey === `reorder:${activeSetlist.id}`
                            }
                          >
                            <ArrowDown className="size-3" />
                          </Button>
                        </div>

                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() =>
                            setSession({
                              setlistId: activeSetlist.id,
                              currentItemId: setlistItem.karaokeItemId,
                              queueItemIds: activeSetlist.items.map((entry) => entry.karaokeItemId),
                              currentIndex: index,
                            })
                          }
                        >
                          <div className="truncate font-medium text-white">
                            {item?.title ?? "Unavailable item"}
                          </div>
                          <div className="truncate text-sm text-white/55">
                            {item?.artist ?? "This song could not be loaded"}
                          </div>
                          {item && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                  getStatusTone(item.status)
                                )}
                              >
                                {STATUS_COPY[item.status]}
                              </span>
                              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55">
                                {formatKaraokeProvider(item.primaryProvider)}
                              </span>
                              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55">
                                {item.lineCount} lines
                              </span>
                            </div>
                          )}
                        </button>

                        <div className="flex flex-col gap-2">
                          {item && (
                            <Button
                              size="sm"
                              onClick={() =>
                                router.push(`/karaoke/${item.id}?setlist=${activeSetlist.id}`)
                              }
                            >
                              <PlayCircle className="size-4" />
                              Studio
                            </Button>
                          )}
                          {item?.track?.url && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                              asChild
                            >
                              <Link href={item.track.url} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-4" />
                                Open
                              </Link>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white/55 hover:text-white"
                            onClick={() => void removeSetlistItem(setlistItem.id)}
                            disabled={busyKey === `remove:${setlistItem.id}`}
                          >
                            {busyKey === `remove:${setlistItem.id}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-white/45">
                  Add songs from the provider shelves to start a setlist.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-black/35 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-white">Session strip</h2>
                <p className="text-sm text-white/50">
                  Keep your place while you browse the provider library.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">
                {session.currentIndex + 1}/{Math.max(session.queueItemIds.length, 1)}
              </span>
            </div>

            {currentSessionItem?.item ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-white/35">
                    Now focused
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {currentSessionItem.item.title}
                  </div>
                  <div className="text-sm text-white/55">
                    {currentSessionItem.item.artist}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                      getStatusTone(currentSessionItem.item.status)
                    )}
                  >
                    {STATUS_COPY[currentSessionItem.item.status]}
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55">
                    {formatKaraokeProvider(currentSessionItem.item.primaryProvider)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() =>
                      router.push(
                        `/karaoke/${currentSessionItem.item?.id}?setlist=${activeSetlist?.id ?? ""}`
                      )
                    }
                  >
                    <PlayCircle className="size-4" />
                    Open studio
                  </Button>
                  {currentSessionItem.item.track?.url && (
                    <Button
                      variant="outline"
                      className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
                      asChild
                    >
                      <Link
                        href={currentSessionItem.item.track.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-4" />
                        Source
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                Select a song in the active setlist to keep it in focus while you browse.
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
