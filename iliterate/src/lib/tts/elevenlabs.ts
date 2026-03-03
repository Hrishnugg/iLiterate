const ELEVENLABS_TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const FALLBACK_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const DEFAULT_MODEL_CHARACTER_LIMIT = 5000;

const MODEL_CHARACTER_LIMITS: Record<string, number> = {
  eleven_v3: 5000,
  eleven_multilingual_v2: 10000,
  eleven_flash_v2_5: 40000,
  eleven_flash_v2: 30000,
  eleven_turbo_v2_5: 40000,
  eleven_turbo_v2: 30000,
};

const LANGUAGE_ALIASES: Record<string, string> = {
  ar: "ar",
  arabic: "ar",
  de: "de",
  german: "de",
  en: "en",
  english: "en",
  es: "es",
  spanish: "es",
  "spanish (spain)": "es",
  "spanish (latin american)": "es",
  fr: "fr",
  french: "fr",
  hi: "hi",
  hindi: "hi",
  id: "id",
  indonesian: "id",
  it: "it",
  italian: "it",
  ja: "ja",
  japanese: "ja",
  ko: "ko",
  korean: "ko",
  nl: "nl",
  dutch: "nl",
  pl: "pl",
  polish: "pl",
  pt: "pt",
  portuguese: "pt",
  "portuguese (brazilian)": "pt",
  "portuguese (european)": "pt",
  ru: "ru",
  russian: "ru",
  th: "th",
  thai: "th",
  tr: "tr",
  turkish: "tr",
  vi: "vi",
  vietnamese: "vi",
  zh: "zh",
  chinese: "zh",
  mandarin: "zh",
  cantonese: "zh",
  "chinese (mandarin)": "zh",
  "chinese (cantonese)": "zh",
  "chinese (simplified)": "zh",
  "chinese (traditional)": "zh",
  "simplified chinese": "zh",
  "traditional chinese": "zh",
};

const VOICE_ENV_KEYS_BY_LANGUAGE: Record<string, string> = {
  ar: "ELEVENLABS_VOICE_ID_AR",
  de: "ELEVENLABS_VOICE_ID_DE",
  en: "ELEVENLABS_VOICE_ID_EN",
  es: "ELEVENLABS_VOICE_ID_ES",
  fr: "ELEVENLABS_VOICE_ID_FR",
  hi: "ELEVENLABS_VOICE_ID_HI",
  id: "ELEVENLABS_VOICE_ID_ID",
  it: "ELEVENLABS_VOICE_ID_IT",
  ja: "ELEVENLABS_VOICE_ID_JA",
  ko: "ELEVENLABS_VOICE_ID_KO",
  nl: "ELEVENLABS_VOICE_ID_NL",
  pl: "ELEVENLABS_VOICE_ID_PL",
  pt: "ELEVENLABS_VOICE_ID_PT",
  ru: "ELEVENLABS_VOICE_ID_RU",
  th: "ELEVENLABS_VOICE_ID_TH",
  tr: "ELEVENLABS_VOICE_ID_TR",
  vi: "ELEVENLABS_VOICE_ID_VI",
  zh: "ELEVENLABS_VOICE_ID_ZH",
};

export interface GenerateReaderSpeechInput {
  text: string;
  language: string;
}

export interface GenerateReaderSpeechResult {
  audioBytes: Uint8Array;
  contentType: string;
  voiceId: string;
  modelId: string;
  languageCode: string;
}

export class ElevenLabsTtsError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ElevenLabsTtsError";
    this.status = status;
  }
}

function normalizeLanguageCode(language: string): string {
  const normalized = language.trim().toLowerCase().replace(/_/g, "-");
  const collapsedWhitespace = normalized.replace(/\s+/g, " ");

  const alias =
    LANGUAGE_ALIASES[collapsedWhitespace] ??
    LANGUAGE_ALIASES[collapsedWhitespace.replace(/\s*\([^)]*\)\s*/g, "").trim()];
  if (alias) {
    return alias;
  }

  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(normalized)) {
    return normalized.split("-")[0];
  }

  return "en";
}

function resolveVoiceId(language: string): string {
  const languageCode = normalizeLanguageCode(language);
  const envKey = VOICE_ENV_KEYS_BY_LANGUAGE[languageCode];
  const languageVoiceId = envKey ? process.env[envKey] : undefined;

  return (
    languageVoiceId ||
    process.env.ELEVENLABS_VOICE_ID_DEFAULT ||
    FALLBACK_VOICE_ID
  );
}

export function getConfiguredModelId(): string {
  return process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
}

export function getModelCharacterLimit(modelId: string): number {
  return MODEL_CHARACTER_LIMITS[modelId] || DEFAULT_MODEL_CHARACTER_LIMIT;
}

function getApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new ElevenLabsTtsError(
      "ELEVENLABS_API_KEY is not set in environment variables",
      500
    );
  }
  return apiKey;
}

function parseUpstreamErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string") {
    return message;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") {
    return error;
  }

  return null;
}

export async function generateReaderSpeech(
  input: GenerateReaderSpeechInput
): Promise<GenerateReaderSpeechResult> {
  const apiKey = getApiKey();
  const languageCode = normalizeLanguageCode(input.language);
  const voiceId = resolveVoiceId(input.language);
  const modelId = getConfiguredModelId();

  let response: Response;
  try {
    response = await fetch(`${ELEVENLABS_TTS_ENDPOINT}/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input.text,
        model_id: modelId,
        language_code: languageCode,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new ElevenLabsTtsError(`Failed to reach ElevenLabs: ${message}`, 502);
  }

  if (!response.ok) {
    let errorMessage = `ElevenLabs request failed with status ${response.status}`;
    try {
      const errorPayload = await response.json();
      const parsedMessage = parseUpstreamErrorMessage(errorPayload);
      if (parsedMessage) {
        errorMessage = parsedMessage;
      }
    } catch {
      // Ignore JSON parse failures and keep generic status message.
    }

    throw new ElevenLabsTtsError(errorMessage, 502);
  }

  const audioBuffer = await response.arrayBuffer();
  if (audioBuffer.byteLength === 0) {
    throw new ElevenLabsTtsError("ElevenLabs returned empty audio data", 502);
  }

  return {
    audioBytes: new Uint8Array(audioBuffer),
    contentType: response.headers.get("content-type") || "audio/mpeg",
    voiceId,
    modelId,
    languageCode,
  };
}
