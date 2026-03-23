import { z } from "zod";

// Common UUID validation
export const uuidSchema = z.string().uuid("Invalid ID format");

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
