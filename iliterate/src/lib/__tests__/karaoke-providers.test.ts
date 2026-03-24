import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectKaraokeProvider,
  normalizeKaraokeTrackUrl,
} from "../karaoke/providers";

describe("detectKaraokeProvider", () => {
  it("detects supported provider URLs", () => {
    expect(detectKaraokeProvider("https://open.spotify.com/track/abc123")).toBe("spotify");
    expect(detectKaraokeProvider("https://music.apple.com/us/song/example/12345")).toBe(
      "apple_music"
    );
    expect(detectKaraokeProvider("https://soundcloud.com/artist/track")).toBe("soundcloud");
  });
});

describe("normalizeKaraokeTrackUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes SoundCloud URLs with oEmbed metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: "Night Drive",
          author_name: "Skyline",
          thumbnail_url: "https://img.example/night-drive.jpg",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const track = await normalizeKaraokeTrackUrl("https://soundcloud.com/skyline/night-drive");

    expect(track).toMatchObject({
      provider: "soundcloud",
      title: "Night Drive",
      artist: "Skyline",
      playbackMode: "embedded",
      karaokeCapable: true,
    });
  });

  it("normalizes Spotify URLs from open graph metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        `
          <html>
            <head>
              <meta property="og:title" content="Midnight Run" />
              <meta property="og:description" content="Nova Ensemble" />
              <meta property="og:image" content="https://img.example/midnight-run.jpg" />
            </head>
          </html>
        `,
        { status: 200, headers: { "Content-Type": "text/html" } }
      )
    );

    const track = await normalizeKaraokeTrackUrl("https://open.spotify.com/track/abc123");

    expect(track).toMatchObject({
      provider: "spotify",
      providerTrackId: "abc123",
      title: "Midnight Run",
      artist: "Nova Ensemble",
      playbackMode: "link_out",
      karaokeCapable: false,
    });
  });
});
