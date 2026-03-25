"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  refreshLocale: () => Promise<void>;
}

const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  locale: "en",
  refreshLocale: async () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Messages>(() =>
    getLocaleMessages("en")
  );
  const [locale, setLocale] = useState("en");

  const refreshLocale = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLocale("en");
      setMessages(getLocaleMessages("en"));
      return;
    }

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
      return;
    }

    setLocale("en");
    setMessages(getLocaleMessages("en"));
  }, []);

  useEffect(() => {
    void refreshLocale();
  }, [refreshLocale]);

  const t = (key: string) => resolveKey(messages, key);

  return (
    <I18nContext.Provider value={{ t, locale, refreshLocale }}>
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

export function useRefreshLocale(): () => Promise<void> {
  return useContext(I18nContext).refreshLocale;
}
