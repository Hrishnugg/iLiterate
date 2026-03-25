import { z } from "zod";

// Common UUID validation
export const uuidSchema = z.string().uuid("Invalid ID format");
export const karaokeProviderSchema = z.enum([
  "tts",
  "soundcloud",
  "apple_music",
  "spotify",
]);
export const karaokeMusicProviderSchema = z.enum([
  "soundcloud",
  "apple_music",
  "spotify",
]);
export const karaokeLegacyItemStatusSchema = z.enum([
  "fetching_lyrics",
  "needs_lyrics",
  "needs_timing",
  "ready",
  "error",
]);
export const karaokeItemStatusSchema = z.enum([
  "matching",
  "ready",
  "needs_review",
  "manual_fallback",
  "error",
]);
export const karaokeLyricsStatusSchema = z.enum([
  "queued",
  "matching",
  "ready",
  "needs_review",
  "manual_fallback",
  "error",
]);
export const karaokeTimingStatusSchema = z.enum([
  "not_applicable",
  "draft",
  "ready",
  "needs_review",
]);
export const providerCollectionKindSchema = z.enum([
  "tracks",
  "playlists",
  "recents",
]);

// Supported languages for translation (common language codes)
export const SUPPORTED_LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko",
  "ar", "hi", "bn", "pa", "te", "mr", "ta", "ur", "gu", "kn",
  "vi", "th", "id", "ms", "tl", "nl", "pl", "uk", "ro", "cs",
  "sv", "fi", "da", "no", "el", "he", "tr", "fa", "hu", "sk",
  // Full language names also accepted
  "english", "spanish", "french", "german", "italian", "portuguese",
  "russian", "chinese", "japanese", "korean", "arabic", "hindi",
  // Language name variations (with qualifiers)
  "chinese (mandarin)", "chinese (cantonese)", "mandarin", "cantonese",
  "chinese (simplified)", "chinese (traditional)", "simplified chinese", "traditional chinese",
  "portuguese (brazilian)", "portuguese (european)", "brazilian portuguese",
  "spanish (latin american)", "spanish (spain)",
] as const;

export const languageSchema = z.string().min(2).max(50).refine(
  (val) => {
    const lower = val.toLowerCase();
    // Allow both ISO codes and language names
    return SUPPORTED_LANGUAGES.includes(lower as typeof SUPPORTED_LANGUAGES[number]) ||
      // Also allow any 2-3 letter ISO code pattern
      /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(val) ||
      // Allow language names with parenthetical qualifiers
      /^[a-z]+(\s*\([a-z\s]+\))?$/i.test(val);
  },
  { message: "Unsupported or invalid language code" }
);

// Translation request validation
export const translateRequestSchema = z.object({
  text: z.string().min(1, "Text is required").max(10000, "Text too long (max 10000 characters)"),
  sourceLang: z.union([languageSchema, z.literal("auto")]),
  targetLang: languageSchema,
  contextBefore: z.string().max(500, "Context too long").optional(),
  contextAfter: z.string().max(500, "Context too long").optional(),
  contentId: uuidSchema.optional(),
  lessonId: uuidSchema.optional(),
});

// Reader TTS request validation
export const ttsRequestSchema = z.object({
  contentId: uuidSchema.optional(),
  lessonId: uuidSchema.optional(),
}).refine(
  (data) => data.contentId || data.lessonId,
  { message: "Either contentId or lessonId is required" }
);

// Word TTS request validation (single word / short phrase)
export const ttsWordRequestSchema = z.object({
  text: z.string().min(1, "Text is required").max(500, "Text too long"),
  language: languageSchema,
});

export const lyricCueSchema = z.object({
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  startOffset: z.number().min(0),
  endOffset: z.number().min(0),
  text: z.string().min(1).max(5000),
}).refine((cue) => cue.endMs >= cue.startMs, {
  message: "endMs must be greater than or equal to startMs",
  path: ["endMs"],
}).refine((cue) => cue.endOffset >= cue.startOffset, {
  message: "endOffset must be greater than or equal to startOffset",
  path: ["endOffset"],
});

export const karaokeLyricsLineSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(5000),
});

export const karaokeTrackSchema = z.object({
  provider: karaokeMusicProviderSchema,
  providerTrackId: z.string().min(1).max(500),
  url: z.string().url("A valid track URL is required"),
  title: z.string().min(1).max(500),
  artist: z.string().min(1).max(500),
  artworkUrl: z.string().url().nullable().optional(),
  durationMs: z.number().int().min(0).nullable().optional(),
  karaokeCapable: z.boolean(),
  playbackMode: z.enum(["embedded", "link_out"]),
});

export const karaokeTrackLinkRequestSchema = z.object({
  url: z.string().url("A valid track URL is required"),
});

export const karaokeItemCreateSchema = z.object({
  url: z.string().url("A valid track URL is required").optional(),
  track: karaokeTrackSchema.optional(),
  setlistId: uuidSchema.optional(),
}).refine((value) => value.url || value.track, {
  message: "Either a track URL or a normalized track payload is required",
});

export const karaokeLyricsUpdateSchema = z.object({
  text: z.string().max(100_000, "Lyrics are too long"),
  source: z.string().min(1).max(50).optional(),
});

export const karaokeTimelineRequestSchema = z.object({
  provider: karaokeProviderSchema,
  cues: z.array(lyricCueSchema).max(2000, "Too many lyric cues"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const karaokeItemTimelineRequestSchema = z.object({
  provider: karaokeMusicProviderSchema,
  cues: z.array(lyricCueSchema).max(2000, "Too many lyric cues"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const appleMusicConnectSchema = z.object({
  musicUserToken: z.string().min(1, "musicUserToken is required"),
  storefrontId: z.string().min(2).max(10).optional(),
});

export const karaokeSetlistCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const karaokeSetlistUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export const karaokeSetlistItemCreateSchema = z.object({
  karaokeItemId: uuidSchema.optional(),
  track: karaokeTrackSchema.optional(),
  tracks: z.array(karaokeTrackSchema).max(100).optional(),
  url: z.string().url("A valid track URL is required").optional(),
  urls: z.array(z.string().url("A valid track URL is required")).max(100).optional(),
  playlist: z.object({
    provider: karaokeMusicProviderSchema,
    playlistId: z.string().min(1).max(500),
    title: z.string().min(1).max(500).optional(),
  }).optional(),
}).refine((value) => {
  return Boolean(
    value.karaokeItemId ||
      value.track ||
      value.url ||
      (value.tracks && value.tracks.length > 0) ||
      (value.urls && value.urls.length > 0)
  );
}, {
  message: "Provide an existing karaoke item, one track, one URL, or a batch of tracks/URLs",
});

export const karaokeSetlistReorderSchema = z.object({
  itemIds: z.array(uuidSchema).min(1).max(500),
});

// Highlight request validation
export const highlightRequestSchema = z.object({
  contentId: uuidSchema.optional(),
  lessonId: uuidSchema.optional(),
  positionType: z.enum(["offset", "xpath", "cfi"]),
  startPosition: z.union([z.string(), z.number()]),
  endPosition: z.union([z.string(), z.number()]),
  selectedText: z.string().min(1).max(5000),
  contextBefore: z.string().max(500).optional(),
  contextAfter: z.string().max(500).optional(),
  note: z.string().max(5000).optional(),
  translation: z.string().max(1000).optional(),
  transliteration: z.string().max(500).optional(),
  partOfSpeech: z.string().max(100).optional(),
}).refine(
  (data) => data.contentId || data.lessonId,
  { message: "Either contentId or lessonId is required" }
);

// Vocabulary request validation
export const vocabularyRequestSchema = z.object({
  word: z.string().min(1).max(200),
  language: languageSchema,
  translation: z.string().min(1).max(500),
  transliteration: z.string().max(500).optional(),
  partOfSpeech: z.string().max(100).optional(),
  definitions: z.array(z.string().max(1000)).optional(),
  contentId: uuidSchema.optional(),
  lessonId: uuidSchema.optional(),
  contextSentence: z.string().max(1000).optional(),
});

// Reading progress request validation
export const readingProgressRequestSchema = z.object({
  contentId: uuidSchema,
  progress: z.number().min(0).max(100).optional(),
  position: z.number().min(0).optional(),
  wordsRead: z.number().min(0).optional(),
  completed: z.boolean().optional(),
});

// Helper function to validate request body
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      return { data: null, error: errors.join(", ") };
    }

    return { data: result.data, error: null };
  } catch {
    return { data: null, error: "Invalid JSON body" };
  }
}
