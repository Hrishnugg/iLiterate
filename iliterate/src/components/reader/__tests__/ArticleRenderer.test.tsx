import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArticleRenderer } from "../ArticleRenderer";
import type { Content, Highlight, TranslationLookup } from "@/types/database";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

const useReadingProgressMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast,
}));

vi.mock("../useReadingProgress", () => ({
  useReadingProgress: useReadingProgressMock,
}));

vi.mock("../ReaderLayout", () => ({
  ReaderLayout: ({
    children,
    rightSidebar,
    leftSidebar,
    bookmarkButton,
    audioPlayer,
    contentScrollRef,
    requestRightOpen,
  }: {
    children: React.ReactNode;
    rightSidebar: React.ReactNode;
    leftSidebar?: React.ReactNode;
    bookmarkButton?: React.ReactNode;
    audioPlayer?: React.ReactNode;
    contentScrollRef?: React.RefObject<HTMLDivElement | null>;
    requestRightOpen?: string | null;
  }) => (
    <div>
      <div data-testid="request-right-open">{requestRightOpen ?? "none"}</div>
      <div data-testid="left-sidebar">{leftSidebar}</div>
      <div data-testid="reader-scroll" ref={contentScrollRef}>
        {children}
      </div>
      <div data-testid="right-sidebar">{rightSidebar}</div>
      <div data-testid="bookmark-button">{bookmarkButton}</div>
      <div data-testid="audio-player">{audioPlayer}</div>
    </div>
  ),
}));

vi.mock("../ContentRenderer", () => ({
  ContentRenderer: ({
    highlights,
    focusedHighlightId,
    onSelection,
  }: {
    highlights: Highlight[];
    focusedHighlightId?: string | null;
    onSelection?: (selection: {
      text: string;
      startOffset: number;
      endOffset: number;
      contextBefore: string;
      contextAfter: string;
      range: Range;
    } | null) => void;
  }) => {
    function createSelection() {
      const range = document.createRange();
      const textNode = document.createTextNode("hola");
      const host = document.createElement("div");
      host.appendChild(textNode);
      document.body.appendChild(host);
      range.selectNodeContents(textNode);
      Object.defineProperty(range, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          left: 40,
          top: 80,
          right: 60,
          bottom: 100,
          width: 20,
          height: 20,
          x: 40,
          y: 80,
          toJSON: () => ({}),
        }),
      });

      return {
        text: "hola",
        startOffset: 5,
        endOffset: 9,
        contextBefore: "say ",
        contextAfter: " to everyone",
        range,
      };
    }

    return (
      <div data-testid="content-renderer">
        <div>content-highlights:{highlights.length}</div>
        <div>content-focused:{focusedHighlightId ?? "none"}</div>
        <button onClick={() => onSelection?.(createSelection())}>
          select text
        </button>
      </div>
    );
  },
}));

vi.mock("../TranslatePopover", () => ({
  TranslatePopover: ({
    selection,
    onTranslate,
    onAddNote,
    onSaveWord,
    onClose,
  }: {
    selection: { text: string };
    onTranslate: (text: string) => Promise<unknown>;
    onAddNote: (text: string, note: string, translation?: unknown) => void;
    onSaveWord: (text: string, translation: unknown) => void;
    onClose: () => void;
  }) => {
    const translation = {
      translation: "hello",
      transliteration: "heh-lo",
      partOfSpeech: "interjection",
      definitions: ["used as a greeting"],
      examples: ["hello there"],
    };

    return (
      <div data-testid="translate-popover">
        <div>selection:{selection.text}</div>
        <button onClick={() => void onTranslate(selection.text)}>
          translate selection
        </button>
        <button
          onClick={() =>
            onAddNote(selection.text, "Remember this greeting", translation)
          }
        >
          save note
        </button>
        <button onClick={() => onSaveWord(selection.text, translation)}>
          save word
        </button>
        <button onClick={onClose}>close popover</button>
      </div>
    );
  },
}));

vi.mock("../RightSidebar", () => ({
  RightSidebar: ({
    highlights,
    lookups,
    flashcardTerms,
    focusedHighlightId,
    addingLookupId,
    onAddLookupToFlashcards,
    onClearLookups,
    onRemoveLookup,
    onHighlightClick,
    onDeleteHighlight,
  }: {
    highlights: Highlight[];
    lookups: TranslationLookup[];
    flashcardTerms?: Set<string>;
    focusedHighlightId?: string | null;
    addingLookupId?: string | null;
    onAddLookupToFlashcards?: (lookup: TranslationLookup) => void;
    onClearLookups?: () => void;
    onRemoveLookup?: (id: string) => void;
    onHighlightClick?: (highlight: Highlight) => void;
    onDeleteHighlight?: (id: string) => void;
  }) => (
    <div data-testid="sidebar-mock">
      <div>sidebar-highlights:{highlights.length}</div>
      <div>sidebar-lookups:{lookups.length}</div>
      <div>sidebar-flashcards:{flashcardTerms?.size ?? 0}</div>
      <div>sidebar-focused:{focusedHighlightId ?? "none"}</div>
      <div>sidebar-adding:{addingLookupId ?? "none"}</div>
      <button
        onClick={() => lookups[0] && onAddLookupToFlashcards?.(lookups[0])}
      >
        add first lookup
      </button>
      <button onClick={() => onClearLookups?.()}>clear lookups</button>
      <button onClick={() => lookups[0] && onRemoveLookup?.(lookups[0].id)}>
        remove first lookup
      </button>
      <button
        onClick={() => highlights[0] && onHighlightClick?.(highlights[0])}
      >
        focus first highlight
      </button>
      <button
        onClick={() => highlights[0] && onDeleteHighlight?.(highlights[0].id)}
      >
        delete first highlight
      </button>
    </div>
  ),
}));

vi.mock("../RSVPReader", () => ({
  RSVPReader: () => <div data-testid="rsvp-reader">RSVP Reader</div>,
}));

vi.mock("../AudioPlayer", () => ({
  AudioPlayer: () => <div>Audio Player Stub</div>,
}));

vi.mock("@/components/BookmarkButton", () => ({
  BookmarkButton: () => <div>Bookmark Button Stub</div>,
}));

function makeContent(overrides: Partial<Content> = {}): Content {
  return {
    id: "content-1",
    title: "Reader Title",
    body: "<h2>Heading</h2><p>Hello world.</p>",
    language: "Spanish",
    difficulty_level: "A2",
    content_type: "article",
    topic_tags: ["travel"],
    word_count: 1200,
    estimated_reading_time: 6,
    source_url: null,
    source_upload_id: null,
    is_generated: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeHighlight(
  id: string,
  overrides: Partial<Highlight> = {}
): Highlight {
  return {
    id,
    user_id: "user-1",
    content_id: "content-1",
    position_type: "offset",
    start_position: "12",
    end_position: "16",
    selected_text: "hola",
    context_before: "say ",
    context_after: " to everyone",
    note: "Saved note",
    translation: "hello",
    transliteration: "heh-lo",
    part_of_speech: "interjection",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLookup(
  id: string,
  overrides: Partial<TranslationLookup> = {}
): TranslationLookup {
  return {
    id,
    user_id: "user-1",
    content_id: "content-1",
    source_text: "hola",
    translated_text: "hello",
    source_lang: "es",
    target_lang: "en",
    transliteration: "oh-la",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function createFetchMock(options?: {
  highlights?: Highlight[];
  lookups?: TranslationLookup[];
  flashcardWords?: string[];
  vocabularyResponseMode?: "added" | "duplicate";
}) {
  const state = {
    highlights: [...(options?.highlights ?? [])],
    lookups: [...(options?.lookups ?? [])],
    flashcardWords: new Set(
      (options?.flashcardWords ?? []).map((word) => word.trim().toLowerCase())
    ),
  };

  const fetchMock = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/highlights?")) {
        return jsonResponse(state.highlights);
      }

      if (url === "/api/highlights" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        state.highlights = [
          ...state.highlights,
          makeHighlight(`highlight-${state.highlights.length + 1}`, {
            content_id: body.contentId ?? body.lessonId,
            start_position: String(body.startPosition),
            end_position: String(body.endPosition),
            selected_text: body.selectedText,
            context_before: body.contextBefore ?? null,
            context_after: body.contextAfter ?? null,
            note: body.note ?? null,
            translation: body.translation ?? null,
            transliteration: body.transliteration ?? null,
            part_of_speech: body.partOfSpeech ?? null,
          }),
        ];
        return jsonResponse({ ok: true });
      }

      if (url.startsWith("/api/highlights/") && method === "DELETE") {
        const highlightId = url.split("/").pop();
        state.highlights = state.highlights.filter(
          (highlight) => highlight.id !== highlightId
        );
        return jsonResponse({ ok: true });
      }

      if (url.startsWith("/api/translation-lookups?") && method === "GET") {
        return jsonResponse(state.lookups);
      }

      if (url.startsWith("/api/translation-lookups?") && method === "DELETE") {
        const parsed = new URL(url, "http://localhost");
        const lookupId = parsed.searchParams.get("id");
        if (lookupId) {
          state.lookups = state.lookups.filter((lookup) => lookup.id !== lookupId);
        } else {
          state.lookups = [];
        }
        return jsonResponse({ ok: true });
      }

      if (url === "/api/vocabulary" && method === "GET") {
        return jsonResponse(
          [...state.flashcardWords].map((word) => ({
            vocabulary: { word },
          }))
        );
      }

      if (url === "/api/vocabulary" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        const normalized = String(body.word ?? "")
          .trim()
          .toLowerCase();

        if (
          options?.vocabularyResponseMode === "duplicate" ||
          state.flashcardWords.has(normalized)
        ) {
          state.flashcardWords.add(normalized);
          return jsonResponse({ message: "Word already in your vocabulary" });
        }

        state.flashcardWords.add(normalized);
        return jsonResponse({ message: "Added to vocabulary" });
      }

      if (url === "/api/translate" && method === "POST") {
        return jsonResponse({
          translation: "hello",
          transliteration: "heh-lo",
          partOfSpeech: "interjection",
          definitions: ["used as a greeting"],
        });
      }

      throw new Error(`Unhandled fetch request: ${method} ${url}`);
    }
  );

  vi.stubGlobal("fetch", fetchMock);

  return { fetchMock, state };
}

describe("ArticleRenderer", () => {
  beforeEach(() => {
    toast.success.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
    useReadingProgressMock.mockReset();
    useReadingProgressMock.mockReturnValue({
      progress: 25,
      wordsRead: 300,
      getTimeRemaining: vi.fn(() => "4 min"),
    });
    vi.spyOn(window, "getSelection").mockReturnValue({
      removeAllRanges: vi.fn(),
    } as unknown as Selection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
    document.body.innerHTML = "";
  });

  it("hydrates highlights, lookups, and flashcard terms on mount", async () => {
    createFetchMock({
      highlights: [makeHighlight("h-1")],
      lookups: [makeLookup("lookup-1")],
      flashcardWords: ["hola"],
    });

    render(<ArticleRenderer content={makeContent()} />);

    expect(await screen.findByText("sidebar-highlights:1")).toBeInTheDocument();
    expect(screen.getByText("sidebar-lookups:1")).toBeInTheDocument();
    expect(screen.getByText("sidebar-flashcards:1")).toBeInTheDocument();
    expect(screen.getByText("Bookmark Button Stub")).toBeInTheDocument();
    expect(screen.getByText("Audio Player Stub")).toBeInTheDocument();
  });

  it("sends translate requests with content selection context", async () => {
    const { fetchMock } = createFetchMock({
      lookups: [makeLookup("lookup-1")],
    });
    const user = userEvent.setup();

    render(<ArticleRenderer content={makeContent()} />);

    await user.click(await screen.findByRole("button", { name: "select text" }));
    expect(await screen.findByTestId("translate-popover")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "translate selection" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/translate",
        expect.objectContaining({ method: "POST" })
      );
    });

    const translateCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/translate" &&
        (init as RequestInit | undefined)?.method === "POST"
    );
    const body = JSON.parse(String(translateCall?.[1]?.body ?? "{}"));

    expect(body).toMatchObject({
      text: "hola",
      sourceLang: "Spanish",
      targetLang: "en",
      contextBefore: "say ",
      contextAfter: " to everyone",
      contentId: "content-1",
    });
    expect(body).not.toHaveProperty("lessonId");
  });

  it("uses lesson ids for lesson translation requests", async () => {
    const { fetchMock } = createFetchMock();
    const user = userEvent.setup();

    render(<ArticleRenderer content={makeContent()} isLesson />);

    await user.click(await screen.findByRole("button", { name: "select text" }));
    await user.click(await screen.findByRole("button", { name: "translate selection" }));

    await waitFor(() => {
      const translateCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === "/api/translate" &&
          (init as RequestInit | undefined)?.method === "POST"
      );
      expect(translateCall).toBeTruthy();
    });

    const translateCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/translate" &&
        (init as RequestInit | undefined)?.method === "POST"
    );
    const body = JSON.parse(String(translateCall?.[1]?.body ?? "{}"));

    expect(body.lessonId).toBe("content-1");
    expect(body).not.toHaveProperty("contentId");
  });

  it("saves notes, reloads highlights, and clears the active selection", async () => {
    const { fetchMock } = createFetchMock();
    const removeAllRanges = vi.fn();
    vi.spyOn(window, "getSelection").mockReturnValue({
      removeAllRanges,
    } as unknown as Selection);
    const user = userEvent.setup();

    render(<ArticleRenderer content={makeContent()} />);

    await user.click(await screen.findByRole("button", { name: "select text" }));
    await user.click(await screen.findByRole("button", { name: "save note" }));

    await waitFor(() => {
      expect(screen.getByText("sidebar-highlights:1")).toBeInTheDocument();
    });

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/highlights" &&
        (init as RequestInit | undefined)?.method === "POST"
    );
    const body = JSON.parse(String(postCall?.[1]?.body ?? "{}"));

    expect(body).toMatchObject({
      contentId: "content-1",
      startPosition: 5,
      endPosition: 9,
      selectedText: "hola",
      contextBefore: "say ",
      contextAfter: " to everyone",
      note: "Remember this greeting",
      translation: "hello",
      transliteration: "heh-lo",
      partOfSpeech: "interjection",
    });
    expect(removeAllRanges).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("translate-popover")).not.toBeInTheDocument();
  });

  it("saves words, updates flashcard state, and short-circuits duplicate lookup adds", async () => {
    const { fetchMock } = createFetchMock({
      lookups: [makeLookup("lookup-1")],
    });
    const user = userEvent.setup();

    render(<ArticleRenderer content={makeContent()} />);

    await user.click(await screen.findByRole("button", { name: "select text" }));
    await user.click(await screen.findByRole("button", { name: "save word" }));

    await waitFor(() => {
      expect(screen.getByText("sidebar-flashcards:1")).toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith("Added to flashcards!");

    const vocabularyPostsBeforeDuplicate = fetchMock.mock.calls.filter(
      ([url, init]) =>
        url === "/api/vocabulary" &&
        (init as RequestInit | undefined)?.method === "POST"
    ).length;

    await user.click(screen.getByRole("button", { name: "add first lookup" }));

    const vocabularyPostsAfterDuplicate = fetchMock.mock.calls.filter(
      ([url, init]) =>
        url === "/api/vocabulary" &&
        (init as RequestInit | undefined)?.method === "POST"
    ).length;

    expect(vocabularyPostsAfterDuplicate).toBe(vocabularyPostsBeforeDuplicate);
    expect(toast.info).toHaveBeenCalledWith("Word already in your flashcards");
  });

  it("clears and removes lookups through sidebar actions", async () => {
    createFetchMock({
      lookups: [makeLookup("lookup-1"), makeLookup("lookup-2", { source_text: "adios" })],
    });
    const user = userEvent.setup();

    render(<ArticleRenderer content={makeContent()} />);

    expect(await screen.findByText("sidebar-lookups:2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "remove first lookup" }));
    await waitFor(() => {
      expect(screen.getByText("sidebar-lookups:1")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "clear lookups" }));
    await waitFor(() => {
      expect(screen.getByText("sidebar-lookups:0")).toBeInTheDocument();
    });
  });

  it("focuses and deletes highlights, then restores the saved reading position", async () => {
    createFetchMock({
      highlights: [makeHighlight("highlight-1", { note: "Important note" })],
    });
    const user = userEvent.setup();

    render(<ArticleRenderer content={makeContent()} />);

    const scrollContainer = await screen.findByTestId("reader-scroll");
    const scrollTo = vi.fn();
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      writable: true,
      value: 320,
    });
    Object.defineProperty(scrollContainer, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollTo,
    });

    await user.click(screen.getByRole("button", { name: "focus first highlight" }));

    expect(await screen.findByText("sidebar-focused:highlight-1")).toBeInTheDocument();
    expect(screen.getByTestId("request-right-open")).toHaveTextContent(
      "highlight-1"
    );
    expect(
      screen.getByRole("button", { name: /back to reading/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to reading/i }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 320, behavior: "smooth" });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /back to reading/i })
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "delete first highlight" }));
    await waitFor(() => {
      expect(screen.getByText("sidebar-highlights:0")).toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith("Highlight deleted");
  });
});
