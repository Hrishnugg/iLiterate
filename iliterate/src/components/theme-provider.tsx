"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  themes: Theme[];
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const DEFAULT_THEME: Theme = "system";
const DEFAULT_RESOLVED_THEME: ResolvedTheme = "light";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function normalizeTheme(theme?: Theme): Theme {
  return theme === "light" || theme === "dark" || theme === "system"
    ? theme
    : DEFAULT_THEME;
}

function readStoredTheme(fallback: Theme): Theme {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return DEFAULT_RESOLVED_THEME;
  }

  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function resolveTheme(theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme {
  return theme === "system" ? systemTheme : theme;
}

function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  enableSystem = true,
}: ThemeProviderProps) {
  const normalizedDefaultTheme = normalizeTheme(defaultTheme);
  const [theme, setThemeState] = useState<Theme>(() =>
    readStoredTheme(normalizedDefaultTheme)
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MEDIA_QUERY);

    const syncSystemTheme = (event?: MediaQueryListEvent) => {
      setSystemTheme(event?.matches ?? mediaQuery.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncSystemTheme);
      return () => mediaQuery.removeEventListener("change", syncSystemTheme);
    }

    mediaQuery.addListener(syncSystemTheme);
    return () => mediaQuery.removeListener(syncSystemTheme);
  }, [normalizedDefaultTheme]);

  useEffect(() => {
    const nextResolvedTheme = resolveTheme(
      enableSystem ? theme : theme === "system" ? "light" : theme,
      systemTheme
    );

    applyTheme(nextResolvedTheme);

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures in locked-down browser contexts.
    }
  }, [enableSystem, systemTheme, theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      setThemeState(
        isTheme(event.newValue) ? event.newValue : normalizedDefaultTheme
      );
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [normalizedDefaultTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: resolveTheme(
        enableSystem ? theme : theme === "system" ? "light" : theme,
        systemTheme
      ),
      systemTheme,
      themes: enableSystem ? ["light", "dark", "system"] : ["light", "dark"],
      setTheme: setThemeState,
    }),
    [enableSystem, systemTheme, theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
