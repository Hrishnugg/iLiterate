export interface GroundingChunk {
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

function clampBreakIndex(source: string, proposedEnd: number, minEnd: number) {
  if (proposedEnd >= source.length) {
    return source.length;
  }

  const candidates = [
    source.lastIndexOf("\n\n", proposedEnd),
    source.lastIndexOf("\n", proposedEnd),
    source.lastIndexOf(". ", proposedEnd),
    source.lastIndexOf("! ", proposedEnd),
    source.lastIndexOf("? ", proposedEnd),
    source.lastIndexOf("。", proposedEnd),
  ].filter((value) => value >= minEnd);

  if (candidates.length === 0) {
    return proposedEnd;
  }

  return Math.max(...candidates);
}

export function chunkTextForGrounding(
  text: string,
  options?: {
    maxChars?: number;
    overlapChars?: number;
  }
) {
  const maxChars = options?.maxChars ?? 1800;
  const overlapChars = options?.overlapChars ?? 220;
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [] as GroundingChunk[];
  }

  const chunks: GroundingChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    const proposedEnd = Math.min(start + maxChars, normalized.length);
    const minEnd = Math.min(start + Math.floor(maxChars * 0.6), normalized.length);
    let end = clampBreakIndex(normalized, proposedEnd, minEnd);

    if (end <= start) {
      end = proposedEnd;
    }

    const rawSlice = normalized.slice(start, end);
    const slice = rawSlice.trim();

    if (slice) {
      const leadingTrimmed = rawSlice.search(/\S/);
      const trailingTrimmed = rawSlice.length - rawSlice.trimEnd().length;

      chunks.push({
        index: chunks.length,
        text: slice,
        startOffset: start + Math.max(leadingTrimmed, 0),
        endOffset: end - trailingTrimmed,
      });
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

function tokenizeQuery(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f\u3040-\u30ff\u3400-\u9fff]+/u)
    .filter((token) => token.length >= 3);
}

function scoreChunk(text: string, tokens: string[]) {
  if (tokens.length === 0) {
    return 0;
  }

  const lower = text.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (lower.includes(token)) {
      score += 4;
    }

    const occurrences = lower.split(token).length - 1;
    score += Math.min(occurrences, 4);
  }

  return score;
}

export function selectGroundingChunks(
  chunks: GroundingChunk[],
  query: string,
  options?: {
    maxChunks?: number;
    mode?: "chat" | "summary" | "translation" | "vocabulary";
  }
) {
  const maxChunks = options?.maxChunks ?? 5;
  const mode = options?.mode ?? "chat";

  if (chunks.length <= maxChunks) {
    return chunks;
  }

  const tokens = tokenizeQuery(query);
  const ranked = chunks.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk.text, tokens),
  }));

  const selected = new Set<number>();

  if (mode !== "chat" || tokens.length === 0) {
    selected.add(0);
  }

  for (const { chunk } of ranked
    .slice()
    .sort((left, right) => right.score - left.score || left.chunk.index - right.chunk.index)) {
    selected.add(chunk.index);
    if (selected.size >= maxChunks) {
      break;
    }
  }

  if (selected.size < maxChunks) {
    for (const chunk of chunks) {
      selected.add(chunk.index);
      if (selected.size >= maxChunks) {
        break;
      }
    }
  }

  return chunks.filter((chunk) => selected.has(chunk.index)).sort((a, b) => a.index - b.index);
}

export function summarizeTextPreview(text: string, maxLength = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
