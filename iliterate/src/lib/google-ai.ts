import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Lazy initialization to avoid build-time failures
let _genAI: GoogleGenerativeAI | null = null;
let _geminiModel: GenerativeModel | null = null;

function getGeminiModel(): GenerativeModel {
  if (!_geminiModel) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY is not set in environment variables");
    }
    _genAI = new GoogleGenerativeAI(apiKey);
    _geminiModel = _genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
    });
  }
  return _geminiModel;
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
  const result = await geminiModel.generateContent(prompt);
  const response = result.response;
  const textResponse = response.text();

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

  return {
    translation: parsed.translation,
    transliteration: parsed.transliteration,
    partOfSpeech: parsed.partOfSpeech,
    definitions: parsed.definitions || [],
    examples: parsed.examples || [],
  };
}
