"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LANGUAGE_TO_LOCALE,
  Messages,
  getLocaleMessages,
  resolveKey,
} from "./index";

interface I18nContextValue {
  t: (key: string) => string;
  locale: string;
}

const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  locale: "en",
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Messages>(() =>
    getLocaleMessages("en")
  );
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    async function loadLocale() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("native_language")
        .eq("id", user.id)
        .single();

      if (profile?.native_language) {
        const localeCode =
          LANGUAGE_TO_LOCALE[profile.native_language.toLowerCase()] ?? "en";
        setLocale(localeCode);
        setMessages(getLocaleMessages(localeCode));
      }
    }
    loadLocale();
  }, []);

  const t = (key: string) => resolveKey(messages, key);

  return (
    <I18nContext.Provider value={{ t, locale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT(): (key: string) => string {
  return useContext(I18nContext).t;
}

export function useLocale(): string {
  return useContext(I18nContext).locale;
}
