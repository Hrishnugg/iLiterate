import {
  KaraokeLyricsLine,
  KaraokePlaybackProvider,
  LyricCue,
} from "@/types/database";

const SENTENCE_ENDINGS = new Set([".", "!", "?", "…", "。", "！", "？"]);
const CLAUSE_BREAKS = new Set([
  ",",
  ";",
  ":",
  "،",
  "，",
  "、",
  "；",
  "：",
]);

function isWhitespace(value: string | undefined): boolean {
  return value !== undefined && /\s/.test(value);
}

export function isCjkLanguage(language?: string | null): boolean {
  const lower = language?.toLowerCase() ?? "";
  return (
    lower.includes("chinese") ||
    lower.includes("japanese") ||
    lower.includes("korean")
  );
}

export function countReadingUnits(text: string, language?: string | null): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  if (isCjkLanguage(language)) {
    const visibleChars = Array.from(trimmed).filter((char) => {
      return !isWhitespace(char) && !SENTENCE_ENDINGS.has(char) && !CLAUSE_BREAKS.has(char);
    }).length;
    return Math.max(1, Math.ceil(visibleChars / 2));
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function estimateSegmentDurationMs(
  text: string,
  language?: string | null,
  wordsPerMinute = 150
): number {
  const readingUnits = countReadingUnits(text, language);
  const pacedMs =
    readingUnits > 0 ? Math.round((readingUnits / wordsPerMinute) * 60_000) : 0;
  const punctuationBonus = /[.!?。！？]/.test(text) ? 500 : 0;

  return Math.max(1500, Math.min(8000, pacedMs + punctuationBonus + 500));
}

export function splitLyricsTextToLines(text: string): KaraokeLyricsLine[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => ({
      id: `line-${index + 1}`,
      text: line,
    }));
}

export function joinLyricsLines(lines: KaraokeLyricsLine[]): string {
  return lines
    .map((line) => line.text.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function buildLyricCuesFromLines(
  lines: KaraokeLyricsLine[],
  language?: string | null
): LyricCue[] {
  let currentOffset = 0;
  let currentTime = 0;

  return lines
    .map((line) => line.text.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const startOffset = currentOffset;
      const endOffset = startOffset + line.length;
      const duration = estimateSegmentDurationMs(line, language);
      const cue = {
        startMs: currentTime,
        endMs: currentTime + duration,
        startOffset,
        endOffset,
        text: line,
      };

      currentOffset = endOffset + 1;
      currentTime = cue.endMs;

      return cue;
    });
}

export function findActiveLyricCueIndex(
  cues: LyricCue[],
  currentPositionMs: number
): number {
  if (cues.length === 0) {
    return 0;
  }

  const directMatch = cues.findIndex(
    (cue) => currentPositionMs >= cue.startMs && currentPositionMs < cue.endMs
  );

  if (directMatch >= 0) {
    return directMatch;
  }

  if (currentPositionMs < cues[0].startMs) {
    return 0;
  }

  return cues.reduce((bestIndex, cue, index) => {
    const bestDistance = Math.abs(cues[bestIndex].startMs - currentPositionMs);
    const nextDistance = Math.abs(cue.startMs - currentPositionMs);
    return nextDistance < bestDistance ? index : bestIndex;
  }, 0);
}

export function getKaraokeItemReadyStatus(
  provider: Exclude<KaraokePlaybackProvider, "tts">,
  hasTimeline: boolean
): "ready" | "needs_timing" {
  if (provider === "spotify") {
    return "ready";
  }

  return hasTimeline ? "ready" : "needs_timing";
}
