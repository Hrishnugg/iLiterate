import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Lazy initialization to avoid build-time failures
let _genAI: GoogleGenerativeAI | null = null;
let _geminiModel: GenerativeModel | null = null;

// Simple in-memory cache for translations (cleared on server restart)
const translationCache = new Map<string, { response: TranslationResponse; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour cache
const MAX_CACHE_SIZE = 1000;

function getGeminiModel(): GenerativeModel {
  if (!_geminiModel) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY is not set in environment variables");
    }
    _genAI = new GoogleGenerativeAI(apiKey);
    _geminiModel = _genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        // @ts-expect-error - thinkingConfig is supported by gemini-3-flash-preview
        thinkingConfig: {
          thinkingLevel: "MINIMAL",
        },
      },
    });
  }
  return _geminiModel;
}

// Generate cache key from request
function getCacheKey(request: TranslationRequest): string {
  return `${request.text.toLowerCase().trim()}|${request.sourceLang}|${request.targetLang}`;
}

// Clean old cache entries
function cleanCache(): void {
  const now = Date.now();
  for (const [key, value] of translationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      translationCache.delete(key);
    }
  }
  // If still too large, remove oldest entries
  if (translationCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(translationCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => translationCache.delete(key));
  }
}

export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  contextBefore?: string;
  contextAfter?: string;
}

export interface TranslationResponse {
  translation: string;
  transliteration?: string;
  partOfSpeech?: string;
  definitions: string[];
  examples: string[];
}

export async function translateWithContext(
  request: TranslationRequest
): Promise<TranslationResponse> {
  const { text, sourceLang, targetLang, contextBefore, contextAfter } = request;

  // Check cache first
  const cacheKey = getCacheKey(request);
  const cached = translationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.response;
  }

  // Clean cache periodically (every 100 requests)
  if (translationCache.size > 0 && translationCache.size % 100 === 0) {
    cleanCache();
  }

  // Sanitize inputs to prevent prompt injection
  const sanitize = (str: string | undefined): string => {
    if (!str) return "N/A";
    // Escape characters that could be used for prompt injection
    return str.replace(/["""]/g, "'").slice(0, 500);
  };

  const prompt = `You are a language learning assistant. Translate the following text from ${sanitize(sourceLang)} to ${sanitize(targetLang)}.

Context before: "${sanitize(contextBefore)}"
Text to translate: "${sanitize(text)}"
Context after: "${sanitize(contextAfter)}"

Provide your response in this exact JSON format:
{
  "translation": "the translation",
  "transliteration": "pronunciation guide if applicable (e.g., pinyin for Chinese, romaji for Japanese)",
  "partOfSpeech": "noun/verb/adjective/etc",
  "definitions": ["definition 1", "definition 2"],
  "examples": ["example sentence 1", "example sentence 2"]
}

Important:
- Consider the context provided for accurate translation
- If the text is a phrase or idiom, explain its meaning
- Provide 1-2 example sentences showing usage
- Transliteration only for non-Latin scripts`;

  const geminiModel = getGeminiModel();

  let textResponse: string;
  try {
    const result = await geminiModel.generateContent(prompt);
    const geminiResponse = result.response;
    textResponse = geminiResponse.text();
  } catch (apiError) {
    console.error("Gemini API error:", apiError);
    throw new Error(`Translation API error: ${apiError instanceof Error ? apiError.message : "Unknown error"}`);
  }

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse translation response");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Invalid JSON in translation response");
  }

  // Validate required fields
  if (!parsed.translation || typeof parsed.translation !== "string") {
    throw new Error("Translation response missing required translation field");
  }

  const response: TranslationResponse = {
    translation: parsed.translation,
    transliteration: parsed.transliteration,
    partOfSpeech: parsed.partOfSpeech,
    definitions: parsed.definitions || [],
    examples: parsed.examples || [],
  };

  // Cache the result
  translationCache.set(cacheKey, { response, timestamp: Date.now() });

  return response;
}
