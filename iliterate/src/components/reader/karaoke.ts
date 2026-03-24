"use client";

import { KaraokePlaybackProvider, LyricCue } from "@/types/database";

export type ReaderMode = "default" | "rsvp" | "karaoke";

export interface ReaderSegment extends LyricCue {
  id: string;
}

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
const TRAILING_CLOSERS = new Set([
  "\"",
  "'",
  ")",
  "]",
  "}",
  "”",
  "’",
  "）",
  "】",
  "》",
  "」",
  "』",
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

function trimRange(text: string, start: number, end: number) {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && isWhitespace(text[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && isWhitespace(text[nextEnd - 1])) {
    nextEnd -= 1;
  }

  return { start: nextStart, end: nextEnd };
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
  wordsPerMinute = 170
): number {
  const readingUnits = countReadingUnits(text, language);
  const pacedMs =
    readingUnits > 0 ? Math.round((readingUnits / wordsPerMinute) * 60_000) : 0;
  const punctuationBonus = /[.!?。！？]/.test(text) ? 500 : 0;

  return Math.max(1500, Math.min(8000, pacedMs + punctuationBonus + 500));
}

export function buildReaderSegmentsFromCues(cues: LyricCue[]): ReaderSegment[] {
  return [...cues]
    .sort((left, right) => {
      if (left.startMs !== right.startMs) {
        return left.startMs - right.startMs;
      }

      if (left.startOffset !== right.startOffset) {
        return left.startOffset - right.startOffset;
      }

      return left.endOffset - right.endOffset;
    })
    .map((cue) => ({
      id: `${cue.startOffset}-${cue.endOffset}-${cue.startMs}`,
      text: cue.text,
      startOffset: cue.startOffset,
      endOffset: cue.endOffset,
      startMs: cue.startMs,
      endMs: cue.endMs,
    }));
}

export function serializeReaderSegmentsToCues(segments: ReaderSegment[]): LyricCue[] {
  return segments.map((segment) => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    startOffset: segment.startOffset,
    endOffset: segment.endOffset,
    text: segment.text,
  }));
}

export function findActiveReaderSegmentIndex(
  segments: ReaderSegment[],
  currentPositionMs: number
): number {
  if (segments.length === 0) {
    return 0;
  }

  const directMatch = segments.findIndex(
    (segment) => currentPositionMs >= segment.startMs && currentPositionMs < segment.endMs
  );

  if (directMatch >= 0) {
    return directMatch;
  }

  if (currentPositionMs < segments[0].startMs) {
    return 0;
  }

  return segments.reduce((bestIndex, segment, index) => {
    const bestDistance = Math.abs(segments[bestIndex].startMs - currentPositionMs);
    const nextDistance = Math.abs(segment.startMs - currentPositionMs);
    return nextDistance < bestDistance ? index : bestIndex;
  }, 0);
}

export function getDefaultPlaybackProvider(
  linkedProviders: KaraokePlaybackProvider[]
): KaraokePlaybackProvider {
  if (linkedProviders.includes("soundcloud")) return "soundcloud";
  if (linkedProviders.includes("apple_music")) return "apple_music";
  if (linkedProviders.includes("spotify")) return "spotify";
  return "tts";
}

function pushRange(
  text: string,
  ranges: Array<{ start: number; end: number }>,
  start: number,
  end: number
) {
  const trimmed = trimRange(text, start, end);
  if (trimmed.end <= trimmed.start) return;
  ranges.push(trimmed);
}

function createSentenceRanges(text: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let segmentStart = 0;
  let index = 0;

  while (index < text.length) {
    const current = text[index];
    const next = text[index + 1];

    if (current === "\n" && next === "\n") {
      pushRange(text, ranges, segmentStart, index);
      segmentStart = index + 2;
      index += 2;
      continue;
    }

    if (
      current === "." &&
      /\d/.test(text[index - 1] ?? "") &&
      /\d/.test(next ?? "")
    ) {
      index += 1;
      continue;
    }

    if (SENTENCE_ENDINGS.has(current)) {
      let end = index + 1;
      while (TRAILING_CLOSERS.has(text[end] ?? "")) {
        end += 1;
      }
      pushRange(text, ranges, segmentStart, end);
      segmentStart = end;
      index = end;
      continue;
    }

    index += 1;
  }

  pushRange(text, ranges, segmentStart, text.length);
  return ranges;
}

function splitRangeByClauses(
  text: string,
  start: number,
  end: number,
  language?: string | null
) {
  const ranges: Array<{ start: number; end: number }> = [];
  let chunkStart = start;
  let chunkUnits = 0;
  const isCjk = isCjkLanguage(language);
  const maxUnits = isCjk ? 18 : 18;
  const maxChars = isCjk ? 40 : 140;

  for (let index = start; index < end; index += 1) {
    const current = text[index];
    if (!isWhitespace(current)) {
      chunkUnits += isCjk ? 0.5 : 0;
    }

    const chunkLength = index + 1 - chunkStart;
    const shouldBreakOnClause =
      CLAUSE_BREAKS.has(current) &&
      (chunkUnits >= maxUnits * 0.6 || chunkLength >= maxChars * 0.6);

    if (shouldBreakOnClause) {
      pushRange(text, ranges, chunkStart, index + 1);
      chunkStart = index + 1;
      chunkUnits = 0;
    }
  }

  pushRange(text, ranges, chunkStart, end);

  if (ranges.length > 1) {
    return ranges;
  }

  return splitRangeByWordCount(text, start, end, language);
}

function splitRangeByWordCount(
  text: string,
  start: number,
  end: number,
  language?: string | null
) {
  const ranges: Array<{ start: number; end: number }> = [];
  const isCjk = isCjkLanguage(language);
  const maxUnits = isCjk ? 18 : 12;

  if (isCjk) {
    let chunkStart = start;
    let visibleChars = 0;

    for (let index = start; index < end; index += 1) {
      const current = text[index];
      if (!isWhitespace(current) && !SENTENCE_ENDINGS.has(current) && !CLAUSE_BREAKS.has(current)) {
        visibleChars += 1;
      }

      const nextChar = text[index + 1];
      if (visibleChars >= maxUnits * 2 && (isWhitespace(nextChar) || CLAUSE_BREAKS.has(current))) {
        pushRange(text, ranges, chunkStart, index + 1);
        chunkStart = index + 1;
        visibleChars = 0;
      }
    }

    pushRange(text, ranges, chunkStart, end);
    return ranges;
  }

  const slice = text.slice(start, end);
  const wordRegex = /\S+/g;
  const words = Array.from(slice.matchAll(wordRegex));

  if (words.length <= maxUnits) {
    pushRange(text, ranges, start, end);
    return ranges;
  }

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += maxUnits) {
    const first = words[wordIndex];
    const last = words[Math.min(wordIndex + maxUnits - 1, words.length - 1)];

    if (!first?.index && first?.index !== 0) continue;
    if (!last?.index && last?.index !== 0) continue;

    const chunkStart = start + first.index;
    const chunkEnd = start + last.index + last[0].length;
    pushRange(text, ranges, chunkStart, chunkEnd);
  }

  return ranges;
}

function splitOversizedRange(
  text: string,
  start: number,
  end: number,
  language?: string | null
) {
  const slice = text.slice(start, end);
  const readingUnits = countReadingUnits(slice, language);
  const maxUnits = isCjkLanguage(language) ? 18 : 18;
  const maxChars = isCjkLanguage(language) ? 48 : 180;

  if (readingUnits <= maxUnits && slice.length <= maxChars) {
    return [{ start, end }];
  }

  return splitRangeByClauses(text, start, end, language);
}

export function buildReaderSegments(
  text: string,
  language?: string | null
): ReaderSegment[] {
  const segments: ReaderSegment[] = [];
  const sentenceRanges = createSentenceRanges(text);
  let currentTimeMs = 0;

  for (const range of sentenceRanges) {
    const subRanges = splitOversizedRange(text, range.start, range.end, language);

    for (const segmentRange of subRanges) {
      const trimmed = trimRange(text, segmentRange.start, segmentRange.end);
      if (trimmed.end <= trimmed.start) continue;

      const segmentText = text.slice(trimmed.start, trimmed.end);
      const duration = estimateSegmentDurationMs(segmentText, language);
      segments.push({
        id: `${trimmed.start}-${trimmed.end}`,
        text: segmentText,
        startOffset: trimmed.start,
        endOffset: trimmed.end,
        startMs: currentTimeMs,
        endMs: currentTimeMs + duration,
      });
      currentTimeMs += duration;
    }
  }

  return segments;
}
