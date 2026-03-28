"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  Layers,
  Library,
  Search,
  Trophy,
  User,
  Users,
  ClipboardCheck,
  TrendingUp,
  Sparkles,
  X,
} from "lucide-react";
import { useSearch } from "./SearchContext";
import { useT } from "@/lib/i18n/I18nProvider";

interface ContentResult {
  id: string;
  title: string;
  subtitle: string;
  language: string;
}

interface LessonResult {
  id: string;
  title: string;
  subtitle: string;
  status: string;
}

interface VocabResult {
  id: string;
  word: string;
  reading: string | null;
}

interface FriendResult {
  id: string;
  display_name: string;
  username: string | null;
}

interface SearchResults {
  content: ContentResult[];
  lessons: LessonResult[];
  vocabulary: VocabResult[];
  friends: FriendResult[];
}

const PAGE_SHORTCUT_DEFS = [
  { titleKey: "nav.library",     subtitleKey: "search.pages.library",     href: "/library",     icon: Library },
  { titleKey: "nav.flashcards",  subtitleKey: "search.pages.flashcards",  href: "/flashcards",  icon: Layers },
  { titleKey: "nav.quizzes",     subtitleKey: "search.pages.quizzes",     href: "/quizzes",     icon: ClipboardCheck },
  { titleKey: "nav.lessonPlan",  subtitleKey: "search.pages.lessonPlan",  href: "/lesson-plan", icon: GraduationCap },
  { titleKey: "nav.studyChat",   subtitleKey: "search.pages.studyChat",   href: "/study-chat",  icon: Sparkles },
  { titleKey: "nav.social",      subtitleKey: "search.pages.social",      href: "/social",      icon: Users },
  { titleKey: "nav.leaderboard", subtitleKey: "search.pages.leaderboard", href: "/leaderboard", icon: Trophy },
  { titleKey: "nav.progress",    subtitleKey: "search.pages.progress",    href: "/progress",    icon: TrendingUp },
  { titleKey: "nav.profile",     subtitleKey: "search.pages.profile",     href: "/profile",     icon: User },
];

type FlatResult =
  | { kind: "page"; title: string; subtitle: string; href: string; Icon: React.ElementType }
  | { kind: "content"; id: string; title: string; subtitle: string }
  | { kind: "lesson"; id: string; title: string; subtitle: string }
  | { kind: "vocab"; id: string; word: string; reading: string | null }
  | { kind: "friend"; id: string; display_name: string; username: string | null };

type PageShortcut = { title: string; subtitle: string; href: string; icon: React.ElementType };

function buildFlat(query: string, results: SearchResults | null, pageShortcuts: PageShortcut[]): FlatResult[] {
  const flat: FlatResult[] = [];

  // Pages: fuzzy filter against query
  const q = query.toLowerCase();
  const matchedPages = pageShortcuts.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q)
  );
  for (const p of matchedPages) {
    flat.push({ kind: "page", title: p.title, subtitle: p.subtitle, href: p.href, Icon: p.icon });
  }

  if (results) {
    for (const c of results.content) {
      flat.push({ kind: "content", id: c.id, title: c.title, subtitle: c.subtitle });
    }
    for (const l of results.lessons) {
      flat.push({ kind: "lesson", id: l.id, title: l.title, subtitle: l.subtitle });
    }
    for (const v of results.vocabulary) {
      flat.push({ kind: "vocab", id: v.id, word: v.word, reading: v.reading });
    }
    for (const f of results.friends) {
      flat.push({ kind: "friend", id: f.id, display_name: f.display_name, username: f.username });
    }
  }

  return flat;
}

function hrefForResult(result: FlatResult): string {
  if (result.kind === "page") return result.href;
  if (result.kind === "content") return `/reader/${result.id}`;
  if (result.kind === "lesson") return `/lesson-plan/${result.id}`;
  if (result.kind === "vocab") return "/flashcards";
  if (result.kind === "friend") return "/social";
  return "/home";
}

function ResultRow({
  result,
  isSelected,
  onSelect,
}: {
  result: FlatResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const t = useT();

  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [isSelected]);

  let icon: React.ReactNode;
  let primary: string;
  let secondary: string;

  if (result.kind === "page") {
    const Icon = result.Icon;
    icon = <Icon className="size-4 shrink-0 text-muted-foreground" />;
    primary = result.title;
    secondary = result.subtitle;
  } else if (result.kind === "content") {
    icon = <BookOpen className="size-4 shrink-0 text-muted-foreground" />;
    primary = result.title;
    secondary = result.subtitle || t("search.fallback.library");
  } else if (result.kind === "lesson") {
    icon = <GraduationCap className="size-4 shrink-0 text-muted-foreground" />;
    primary = result.title;
    secondary = result.subtitle || t("search.fallback.lesson");
  } else if (result.kind === "vocab") {
    icon = <Layers className="size-4 shrink-0 text-muted-foreground" />;
    primary = result.word;
    secondary = result.reading ?? t("search.fallback.vocabulary");
  } else {
    icon = <Users className="size-4 shrink-0 text-muted-foreground" />;
    primary = result.display_name;
    secondary = result.username ? `@${result.username}` : t("search.fallback.friend");
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/60"
      }`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight">{primary}</span>
        <span className="block truncate text-xs text-muted-foreground leading-tight mt-0.5">
          {secondary}
        </span>
      </span>
    </button>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
  );
}

function groupedSections(flat: FlatResult[]) {
  const pages = flat.filter((r) => r.kind === "page");
  const content = flat.filter((r) => r.kind === "content");
  const lessons = flat.filter((r) => r.kind === "lesson");
  const vocab = flat.filter((r) => r.kind === "vocab");
  const friends = flat.filter((r) => r.kind === "friend");
  return { pages, content, lessons, vocab, friends };
}

export function SearchModal() {
  const { isOpen, closeSearch } = useSearch();
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageShortcuts: PageShortcut[] = PAGE_SHORTCUT_DEFS.map((d) => ({
    title: t(d.titleKey),
    subtitle: t(d.subtitleKey),
    href: d.href,
    icon: d.icon,
  }));

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedIndex(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchResults(value), 300);
    },
    [fetchResults]
  );

  const flat = buildFlat(query, results, pageShortcuts);

  const navigate = useCallback(
    (result: FlatResult) => {
      router.push(hrefForResult(result));
      closeSearch();
    },
    [router, closeSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flat[selectedIndex]) {
        navigate(flat[selectedIndex]);
      } else if (e.key === "Escape") {
        closeSearch();
      }
    },
    [flat, selectedIndex, navigate, closeSearch]
  );

  if (!isOpen) return null;

  const { pages, content, lessons, vocab, friends } = groupedSections(flat);
  const hasResults = flat.length > 0;

  // Build a flat index offset map so ResultRow gets the right global index
  let idx = 0;
  const sections: { label: string; items: FlatResult[] }[] = [];
  if (pages.length) sections.push({ label: t("search.sections.pages"), items: pages });
  if (content.length) sections.push({ label: t("search.sections.library"), items: content });
  if (lessons.length) sections.push({ label: t("search.sections.lessons"), items: lessons });
  if (vocab.length) sections.push({ label: t("search.sections.vocabulary"), items: vocab });
  if (friends.length) sections.push({ label: t("search.sections.friends"), items: friends });

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", backgroundColor: "rgba(0,0,0,0.4)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeSearch();
      }}
    >
      {/* Panel */}
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && (
            <svg
              className="size-4 animate-spin shrink-0 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          <button
            type="button"
            onClick={closeSearch}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto p-2">
          {!query && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("search.startTyping")}
            </div>
          )}

          {query && !hasResults && !loading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("search.noResults").replace("{query}", query)}
            </div>
          )}

          {sections.map((section) => (
            <div key={section.label}>
              <GroupLabel label={section.label} />
              {section.items.map((item) => {
                const itemIdx = idx++;
                return (
                  <ResultRow
                    key={`${item.kind}-${item.kind === "page" ? item.href : item.kind === "vocab" ? item.id : item.id}`}
                    result={item}
                    isSelected={selectedIndex === itemIdx}
                    onSelect={() => navigate(item)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        {hasResults && (
          <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span><kbd className="font-mono">↑↓</kbd> {t("search.hints.navigate")}</span>
            <span><kbd className="font-mono">↵</kbd> {t("search.hints.open")}</span>
            <span><kbd className="font-mono">Esc</kbd> {t("search.hints.close")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
