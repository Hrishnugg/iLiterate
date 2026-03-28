"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "motion/react";
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

const LOCALE_COOKIE = "i18n_locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function persistLocale(localeCode: string) {
  document.cookie = `${LOCALE_COOKIE}=${localeCode}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}`;
}

export function I18nProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: string;
}) {
  const [messages, setMessages] = useState<Messages>(() =>
    getLocaleMessages(initialLocale)
  );
  const [locale, setLocale] = useState(initialLocale);

  const refreshLocale = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      persistLocale("en");
      setLocale("en");
      setMessages(getLocaleMessages("en"));
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("native_language, target_language, ui_language")
      .eq("id", user.id)
      .single();

    if (profile) {
      const langKey =
        profile.ui_language === "target"
          ? profile.target_language
          : profile.native_language;
      const localeCode =
        LANGUAGE_TO_LOCALE[(langKey ?? "").toLowerCase()] ?? "en";
      persistLocale(localeCode);
      setLocale(localeCode);
      setMessages(getLocaleMessages(localeCode));
      return;
    }

    persistLocale("en");
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

/**
 * Wraps a content area and plays a blur-in animation whenever the locale
 * changes. Place it around the main page content (not the sidebar) so that
 * all translated `t()` strings animate smoothly on language switch.
 * The blur starts high and clears to zero, hiding the instant text swap that
 * React performs when new messages are loaded.
 */
export function LocaleBlurWrapper({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const locale = useLocale();
  const controls = useAnimation();
  const isFirstRender = useRef(true);
  const prevLocale = useRef(locale);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevLocale.current = locale;
      return;
    }
    if (prevLocale.current === locale) return;
    prevLocale.current = locale;

    void controls.start({
      filter: ["blur(10px)", "blur(0px)"],
      opacity: [0.15, 1],
      transition: { duration: 0.5, ease: "easeOut" },
    });
  }, [locale, controls]);

  return (
    <motion.div animate={controls} className={className} style={style}>
      {children}
    </motion.div>
  );
}

/** Renders a translated string with a smooth blur crossfade whenever the locale changes.
 *  The old text blurs and fades out while the new text blurs in simultaneously.
 *  Uses GPU-composited filter + opacity so animation stays on the compositor thread. */
export function T({
  id,
  values,
  className,
}: {
  id: string;
  values?: Record<string, string>;
  className?: string;
}) {
  const { locale, t } = useContext(I18nContext);
  let text = t(id);
  if (values) {
    for (const [k, v] of Object.entries(values)) {
      text = text.replace(`{${k}}`, v);
    }
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={locale + id}
          className={className}
          aria-label={text}
          initial={{ filter: "blur(6px)", opacity: 0 }}
          animate={{ filter: "blur(0px)", opacity: 1 }}
          exit={{ filter: "blur(6px)", opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{ display: "inline-block" }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
