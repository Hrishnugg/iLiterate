import { describe, expect, it } from "vitest";
import {
  buildLyricCuesFromLines,
  getKaraokeItemReadyStatus,
  joinLyricsLines,
  splitLyricsTextToLines,
} from "../karaoke/timing";

describe("splitLyricsTextToLines", () => {
  it("normalizes blank lines into karaoke lyric lines", () => {
    const lines = splitLyricsTextToLines(" First line \n\nSecond line\r\nThird line ");

    expect(lines).toEqual([
      { id: "line-1", text: "First line" },
      { id: "line-2", text: "Second line" },
      { id: "line-3", text: "Third line" },
    ]);
    expect(joinLyricsLines(lines)).toBe("First line\nSecond line\nThird line");
  });
});

describe("buildLyricCuesFromLines", () => {
  it("creates sequential cue timings", () => {
    const cues = buildLyricCuesFromLines([
      { id: "line-1", text: "Hello there" },
      { id: "line-2", text: "General Kenobi" },
    ]);

    expect(cues).toHaveLength(2);
    expect(cues[0].startMs).toBe(0);
    expect(cues[0].endMs).toBeGreaterThan(cues[0].startMs);
    expect(cues[1].startMs).toBe(cues[0].endMs);
    expect(cues[1].startOffset).toBeGreaterThan(cues[0].endOffset);
  });
});

describe("getKaraokeItemReadyStatus", () => {
  it("keeps spotify items ready without a saved timeline", () => {
    expect(getKaraokeItemReadyStatus("spotify", false)).toBe("ready");
  });

  it("requires timing for embedded providers without cues", () => {
    expect(getKaraokeItemReadyStatus("soundcloud", false)).toBe("needs_timing");
    expect(getKaraokeItemReadyStatus("apple_music", true)).toBe("ready");
  });
});
