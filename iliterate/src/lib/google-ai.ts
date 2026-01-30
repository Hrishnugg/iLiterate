import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_AI_API_KEY is not set in environment variables");
}

export const genAI = new GoogleGenerativeAI(apiKey);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

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

  const prompt = `You are a language learning assistant. Translate the following text from ${sourceLang} to ${targetLang}.

Context before: "${contextBefore || "N/A"}"
Text to translate: "${text}"
Context after: "${contextAfter || "N/A"}"

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

  const result = await geminiModel.generateContent(prompt);
  const response = result.response;
  const textResponse = response.text();

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse translation response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    translation: parsed.translation,
    transliteration: parsed.transliteration,
    partOfSpeech: parsed.partOfSpeech,
    definitions: parsed.definitions || [],
    examples: parsed.examples || [],
  };
}
