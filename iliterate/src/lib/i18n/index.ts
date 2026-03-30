import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import zhCn from "@/locales/zh-cn.json";
import zhTw from "@/locales/zh-tw.json";
import pt from "@/locales/pt.json";
import ar from "@/locales/ar.json";
import hi from "@/locales/hi.json";

export type Messages = typeof en;
export type TranslationValues = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Maps the lowercase native_language value stored in profiles to a locale code. */
export const LANGUAGE_TO_LOCALE: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  japanese: "ja",
  korean: "ko",
  "chinese (simplified)": "zh-cn",
  "chinese (traditional)": "zh-tw",
  portuguese: "pt",
  arabic: "ar",
  hindi: "hi",
};

const locales: Record<string, Messages> = {
  en,
  es,
  fr: fr as unknown as Messages,
  de: de as unknown as Messages,
  ja: ja as unknown as Messages,
  ko: ko as unknown as Messages,
  "zh-cn": zhCn as unknown as Messages,
  "zh-tw": zhTw as unknown as Messages,
  pt: pt as unknown as Messages,
  ar: ar as unknown as Messages,
  hi: hi as unknown as Messages,
};

export function getLocaleMessages(localeCode: string): Messages {
  return locales[localeCode] ?? locales["en"];
}

function lookupKey(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(
  template: string,
  values?: TranslationValues
): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const value = values[token];
    return value == null ? `{${token}}` : String(value);
  });
}

/** Resolve a dot-separated key path against a messages object. */
export function resolveKey(messages: Messages, key: string): string {
  return lookupKey(messages, key) ?? key;
}

export function translate(
  messages: Messages,
  key: string,
  values?: TranslationValues,
  fallbackMessages: Messages = en
): string {
  const template =
    lookupKey(messages, key) ??
    lookupKey(fallbackMessages, key) ??
    key;

  return interpolate(template, values);
}
