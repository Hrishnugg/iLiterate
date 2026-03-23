import { describe, expect, it } from "vitest";

import {
  chunkTextForGrounding,
  selectGroundingChunks,
  summarizeTextPreview,
} from "@/lib/study-chat/chunking";

describe("study chat chunking", () => {
  it("splits long text into stable overlapping chunks", () => {
    const text = new Array(120).fill("alpha beta gamma delta epsilon").join(" ");

    const chunks = chunkTextForGrounding(text, {
      maxChars: 180,
      overlapChars: 30,
    });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]?.startOffset).toBe(0);
    expect(chunks[1]?.startOffset).toBeLessThan(chunks[0]!.endOffset);
  });

  it("prefers relevant chunks for topical questions", () => {
    const chunks = chunkTextForGrounding(
      [
        "This section introduces the train schedule and platform map.",
        "This section explains weather vocabulary and storm warnings in detail.",
        "This final section covers restaurant etiquette and payment phrases.",
      ].join("\n\n"),
      { maxChars: 90, overlapChars: 10 }
    );

    const selected = selectGroundingChunks(
      chunks,
      "What weather words should I learn?",
      { maxChunks: 2, mode: "chat" }
    );

    expect(selected.some((chunk) => chunk.text.toLowerCase().includes("weather"))).toBe(
      true
    );
  });

  it("creates compact previews for session cards", () => {
    expect(summarizeTextPreview("short preview")).toBe("short preview");
    expect(summarizeTextPreview("a".repeat(240), 40)).toHaveLength(40);
  });
});
