import { describe, expect, it } from "vitest";
import {
  buildReaderSegmentsFromCues,
  buildReaderSegments,
  estimateSegmentDurationMs,
  findActiveReaderSegmentIndex,
} from "../karaoke";

describe("buildReaderSegments", () => {
  it("returns offset-preserving sentence segments", () => {
    const text = "Hello world. Another sentence! Final line?";
    const segments = buildReaderSegments(text, "english");

    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.text)).toEqual([
      "Hello world.",
      "Another sentence!",
      "Final line?",
    ]);
    expect(segments[1]).toMatchObject({
      startOffset: 13,
      endOffset: 30,
    });
    expect(text.slice(segments[1].startOffset, segments[1].endOffset)).toBe(
      segments[1].text
    );
  });

  it("splits oversized text into smaller guided chunks", () => {
    const text =
      "This is a deliberately long sentence with multiple clauses, extra detail, and enough words to force another split without losing the original offsets.";
    const segments = buildReaderSegments(text, "english");

    expect(segments.length).toBeGreaterThan(1);
    expect(
      segments.every(
        (segment) => text.slice(segment.startOffset, segment.endOffset) === segment.text
      )
    ).toBe(true);
  });

  it("assigns increasing timing metadata for autoplay", () => {
    const segments = buildReaderSegments("One. Two. Three.", "english");

    expect(segments[0].startMs).toBe(0);
    expect(segments[0].endMs).toBeGreaterThan(segments[0].startMs ?? 0);
    expect(segments[1].startMs).toBe(segments[0].endMs);
    expect(segments[2].startMs).toBe(segments[1].endMs);
  });
});

describe("estimateSegmentDurationMs", () => {
  it("keeps durations within a short-phrase window", () => {
    const duration = estimateSegmentDurationMs("Short guided segment.", "english");

    expect(duration).toBeGreaterThanOrEqual(1500);
    expect(duration).toBeLessThanOrEqual(8000);
  });
});

describe("buildReaderSegmentsFromCues", () => {
  it("creates stable reader segments from stored cues", () => {
    const segments = buildReaderSegmentsFromCues([
      {
        text: "Second line",
        startOffset: 12,
        endOffset: 23,
        startMs: 1000,
        endMs: 2000,
      },
      {
        text: "First line",
        startOffset: 0,
        endOffset: 10,
        startMs: 0,
        endMs: 1000,
      },
    ]);

    expect(segments.map((segment) => segment.text)).toEqual([
      "First line",
      "Second line",
    ]);
    expect(segments[0].id).toBe("0-10-0");
  });
});

describe("findActiveReaderSegmentIndex", () => {
  it("finds the active segment from playback time", () => {
    const segments = buildReaderSegmentsFromCues([
      {
        text: "One",
        startOffset: 0,
        endOffset: 3,
        startMs: 0,
        endMs: 1000,
      },
      {
        text: "Two",
        startOffset: 4,
        endOffset: 7,
        startMs: 1000,
        endMs: 2200,
      },
    ]);

    expect(findActiveReaderSegmentIndex(segments, 250)).toBe(0);
    expect(findActiveReaderSegmentIndex(segments, 1500)).toBe(1);
    expect(findActiveReaderSegmentIndex(segments, 2800)).toBe(1);
  });
});
