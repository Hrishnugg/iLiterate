"use client";

import {
  KaraokeMusicProvider,
  KaraokePlaybackProvider,
} from "@/types/database";

export type SoundCloudWidget = {
  bind: (
    eventName: string,
    listener: (event: { currentPosition?: number }) => void
  ) => void;
  unbind: (eventName: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (milliseconds: number) => void;
};

export type MusicKitInstance = {
  authorize: () => Promise<string>;
  setQueue: (descriptor: { url: string }) => Promise<unknown>;
  play: () => Promise<unknown>;
  pause: () => Promise<unknown>;
  player: {
    currentPlaybackTime?: number;
    isPlaying?: boolean;
    seekToTime?: (seconds: number) => Promise<unknown>;
  };
};

export function formatKaraokeProvider(provider: KaraokePlaybackProvider): string {
  switch (provider) {
    case "soundcloud":
      return "SoundCloud";
    case "apple_music":
      return "Apple Music";
    case "spotify":
      return "Spotify";
    default:
      return "Guided";
  }
}

export function isEmbeddedKaraokeProvider(provider: KaraokeMusicProvider): boolean {
  return provider === "soundcloud" || provider === "apple_music";
}

export function getKaraokePolicyCopy(provider: KaraokeMusicProvider): string | null {
  if (provider === "spotify") {
    return "Spotify stays metadata-only here. Platform policy blocks syncing Spotify recordings with lyric visuals, so playback remains link-out.";
  }

  return null;
}

export function loadExternalScript(src: string, marker: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if ((window as unknown as Record<string, unknown>)[marker]) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-karaoke-script="${marker}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${marker}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.karaokeScript = marker;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${marker}`));
    document.body.appendChild(script);
  });
}

export async function initializeAppleMusicClient(): Promise<MusicKitInstance> {
  await loadExternalScript(
    "https://js-cdn.music.apple.com/musickit/v1/musickit.js",
    "MusicKit"
  );

  const musicKitGlobal = window as unknown as {
    MusicKit?: {
      configure: (config: {
        developerToken: string;
        storefrontId: string;
        features: string[];
      }) => void;
      getInstance: () => MusicKitInstance;
    };
    __iliterateMusicKitConfigured?: boolean;
  };

  if (!musicKitGlobal.MusicKit) {
    throw new Error("MusicKit JS failed to load");
  }

  const tokenResponse = await fetch("/api/karaoke/providers/apple_music/token");
  if (!tokenResponse.ok) {
    const payload = (await tokenResponse.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error || "Apple Music is not configured");
  }

  const tokenPayload = (await tokenResponse.json()) as {
    developerToken: string;
    storefront: string;
  };

  if (!musicKitGlobal.__iliterateMusicKitConfigured) {
    musicKitGlobal.MusicKit.configure({
      developerToken: tokenPayload.developerToken,
      storefrontId: tokenPayload.storefront || "us",
      features: ["player-accurate-timing"],
    });
    musicKitGlobal.__iliterateMusicKitConfigured = true;
  }

  return musicKitGlobal.MusicKit.getInstance();
}
