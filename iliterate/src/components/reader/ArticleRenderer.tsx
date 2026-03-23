"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { ArrowDown } from "lucide-react";
import { Highlight, TranslationLookup, Content } from "@/types/database";
import { TextSelection } from "./TextHighlighter";
import { TranslatePopover } from "./TranslatePopover";
import { ReaderLayout } from "./ReaderLayout";
import { TableOfContents } from "./TableOfContents";
import { RightSidebar } from "./RightSidebar";
import { ContentRenderer } from "./ContentRenderer";
import { RSVPReader } from "./RSVPReader";
import { KaraokeReader } from "./KaraokeReader";
import { useReadingProgress } from "./useReadingProgress";
import { AudioPlayer } from "./AudioPlayer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookmarkButton } from "@/components/BookmarkButton";
import { countReadingUnits, ReaderMode, ReaderSegment } from "./karaoke";

interface TOCItem {
  id: string;
  title: string;
  level: number;
}

interface ArticleRendererProps {
  content: Content;
  isLesson?: boolean;
}

export function ArticleRenderer({ content, isLesson = false }: ArticleRendererProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [lookups, setLookups] = useState<TranslationLookup[]>([]);
  const [flashcardTerms, setFlashcardTerms] = useState<Set<string>>(new Set());
  const [addingLookupId, setAddingLookupId] = useState<string | null>(null);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0, bottom: 0 });
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [focusedHighlightId, setFocusedHighlightId] = useState<string | null>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(null);
  const [readerMode, setReaderMode] = useState<ReaderMode>("default");
  const [rsvpWordIndex, setRsvpWordIndex] = useState(0);
  const [rsvpTotalWords, setRsvpTotalWords] = useState(0);
  const [rsvpWpm, setRsvpWpm] = useState(250);
  const [karaokeSegments, setKaraokeSegments] = useState<ReaderSegment[]>([]);
  const [karaokeSegmentIndex, setKaraokeSegmentIndex] = useState(0);
  const rsvpSeekFnRef = useRef<((percentage: number) => void) | null>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const normalizeTerm = useCallback((term: string) => term.trim().toLowerCase(), []);
  const isRSVPMode = readerMode === "rsvp";
  const isKaraokeMode = readerMode === "karaoke";

  // Reading progress tracking
  const {
    progress,
    wordsRead,
    getTimeRemaining,
  } = useReadingProgress({
    contentId: content.id,
    wordCount: content.word_count || 1000,
    scrollContainerRef: contentContainerRef,
  });

  // Calculate time remaining based on mode
  const displayTimeRemaining = useMemo(() => {
    if (isRSVPMode && rsvpTotalWords > 0) {
      const wordsLeft = rsvpTotalWords - rsvpWordIndex;
      const minutesLeft = wordsLeft / rsvpWpm;
      const secondsLeft = Math.round(minutesLeft * 60);
      
      if (secondsLeft < 60) {
        return `${secondsLeft}s`;
      }
      
      const minutes = Math.floor(secondsLeft / 60);
      const seconds = secondsLeft % 60;
      return `${minutes}m ${seconds}s`;
    }

    if (isKaraokeMode && karaokeSegments.length > 0) {
      const activeSegment = karaokeSegments[karaokeSegmentIndex];
      const remainingMs =
        (karaokeSegments.at(-1)?.endMs ?? 0) - (activeSegment?.startMs ?? 0);
      const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));

      if (remainingSeconds < 60) {
        return `${remainingSeconds}s`;
      }

      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      return `${minutes}m ${seconds}s`;
    }

    return getTimeRemaining(200); // Normal scroll-based time remaining at 200 WPM
  }, [
    getTimeRemaining,
    isKaraokeMode,
    isRSVPMode,
    karaokeSegmentIndex,
    karaokeSegments,
    rsvpTotalWords,
    rsvpWordIndex,
    rsvpWpm,
  ]);

  // Memoize plain text for RSVP mode
  const plainTextContent = useMemo(
    () => content.body.replace(/<[^>]*>/g, ""),
    [content.body]
  );
  const isArticleLikeContent = useMemo(() => {
    const sourceUrl = content.source_url?.toLowerCase() ?? "";
    return (
      content.content_type !== "pdf" &&
      content.content_type !== "epub" &&
      !sourceUrl.endsWith(".pdf") &&
      !sourceUrl.endsWith(".epub")
    );
  }, [content.content_type, content.source_url]);

  // Calculate RSVP-based progress when in RSVP mode
  const displayProgress = useMemo(() => {
    if (isRSVPMode && rsvpTotalWords > 0) {
      return Math.round((rsvpWordIndex / rsvpTotalWords) * 100);
    }
    if (isKaraokeMode && karaokeSegments.length > 0) {
      const activeSegment = karaokeSegments[Math.min(karaokeSegmentIndex, karaokeSegments.length - 1)];
      const totalLength = karaokeSegments.at(-1)?.endOffset ?? 0;
      if (activeSegment && totalLength > 0) {
        return Math.round((activeSegment.endOffset / totalLength) * 100);
      }
    }
    return progress;
  }, [isKaraokeMode, isRSVPMode, karaokeSegmentIndex, karaokeSegments, progress, rsvpWordIndex, rsvpTotalWords]);

  const displayWordsRead = useMemo(() => {
    if (isRSVPMode) {
      return rsvpWordIndex;
    }
    if (isKaraokeMode && karaokeSegments.length > 0) {
      const units = karaokeSegments
        .slice(0, Math.min(karaokeSegmentIndex + 1, karaokeSegments.length))
        .reduce(
          (total, segment) => total + countReadingUnits(segment.text, content.language),
          0
        );
      return units;
    }
    return wordsRead;
  }, [content.language, isKaraokeMode, isRSVPMode, karaokeSegmentIndex, karaokeSegments, rsvpWordIndex, wordsRead]);

  const displayTotalWords = useMemo(() => {
    if (isRSVPMode && rsvpTotalWords > 0) {
      return rsvpTotalWords;
    }
    if (isKaraokeMode && karaokeSegments.length > 0) {
      return karaokeSegments.reduce(
        (total, segment) => total + countReadingUnits(segment.text, content.language),
        0
      );
    }
    return content.word_count || 1000;
  }, [content.language, content.word_count, isKaraokeMode, isRSVPMode, karaokeSegments, rsvpTotalWords]);

  // Load highlights - memoized with content.id dependency
  const loadHighlights = useCallback(async () => {
    try {
      const param = isLesson ? `lessonId=${content.id}` : `contentId=${content.id}`;
      const response = await fetch(`/api/highlights?${param}`);
      if (response.ok) {
        const data = await response.json();
        setHighlights(data);
      }
    } catch (error) {
      console.error("Failed to load highlights:", error);
    }
  }, [content.id, isLesson]);

  // Load lookups - memoized with content.id dependency
  const loadLookups = useCallback(async () => {
    try {
      const param = isLesson ? `lessonId=${content.id}` : `contentId=${content.id}`;
      const response = await fetch(`/api/translation-lookups?${param}`);
      if (response.ok) {
        const data = await response.json();
        setLookups(data);
      }
    } catch (error) {
      console.error("Failed to load lookups:", error);
    }
  }, [content.id, isLesson]);

  const loadFlashcardTerms = useCallback(async () => {
    try {
      const response = await fetch("/api/vocabulary");
      if (!response.ok) return;

      const data = await response.json();
      const terms = new Set<string>();

      if (Array.isArray(data)) {
        for (const item of data) {
          const word = item?.vocabulary?.word;
          if (typeof word === "string" && word.trim().length > 0) {
            terms.add(normalizeTerm(word));
          }
        }
      }

      setFlashcardTerms(terms);
    } catch (error) {
      console.error("Failed to load flashcard terms:", error);
    }
  }, [normalizeTerm]);

  // Generate TOC from content headings (for HTML content) - memoized
  const generateTOC = useCallback(() => {
    if (typeof window === "undefined") return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(content.body, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3");

    const items: TOCItem[] = [];
    headings.forEach((heading, index) => {
      const id = `heading-${index}`;
      heading.id = id;
      items.push({
        id,
        title: heading.textContent || "",
        level: parseInt(heading.tagName[1]),
      });
    });

    setTocItems(items);
  }, [content.body]);

  // Load highlights and lookups on mount and when content changes
  useEffect(() => {
    loadHighlights();
    loadLookups();
    loadFlashcardTerms();
    generateTOC();
  }, [loadHighlights, loadLookups, loadFlashcardTerms, generateTOC]);

  useEffect(() => {
    if (!isArticleLikeContent && isKaraokeMode) {
      setReaderMode("default");
    }
  }, [isArticleLikeContent, isKaraokeMode]);

  useEffect(() => {
    if (karaokeSegments.length === 0) {
      setKaraokeSegmentIndex(0);
      return;
    }

    setKaraokeSegmentIndex((current) =>
      Math.max(0, Math.min(current, karaokeSegments.length - 1))
    );
  }, [karaokeSegments]);

  // Handle text selection from any content type
  const handleSelection = useCallback((sel: TextSelection | null) => {
    setSelection(sel);
    if (sel) {
      const rect = sel.range.getBoundingClientRect();
      setPopoverPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
        bottom: rect.bottom,
      });
    }
  }, []);

  // Handle EPUB TOC updates
  const handleEpubTocUpdate = useCallback((toc: Array<{ label: string; href: string }>) => {
    // Convert EPUB TOC to our format
    const items: TOCItem[] = toc.map((item) => ({
      id: item.href,
      title: item.label,
      level: 1,
    }));
    setTocItems(items);
  }, []);

  // Handle translate
  const handleTranslate = useCallback(async (text: string) => {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sourceLang: content.language,
        targetLang: "en", // TODO: Get from user profile
        contextBefore: selection?.contextBefore,
        contextAfter: selection?.contextAfter,
        ...(isLesson ? { lessonId: content.id } : { contentId: content.id }),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Translation failed");
    }

    const result = await response.json();

    // Refresh lookups
    await loadLookups();

    return result;
  }, [content.language, content.id, isLesson, selection?.contextBefore, selection?.contextAfter, loadLookups]);

  // Handle add note
  const handleAddNote = useCallback(async (
    text: string,
    note: string,
    translation?: { translation: string; transliteration?: string; partOfSpeech?: string }
  ) => {
    if (!selection) return;

    const response = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isLesson ? { lessonId: content.id } : { contentId: content.id }),
        positionType: "offset",
        startPosition: selection.startOffset,
        endPosition: selection.endOffset,
        selectedText: text,
        contextBefore: selection.contextBefore,
        contextAfter: selection.contextAfter,
        note,
        translation: translation?.translation,
        transliteration: translation?.transliteration,
        partOfSpeech: translation?.partOfSpeech,
      }),
    });

    if (response.ok) {
      await loadHighlights();
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [content.id, isLesson, selection, loadHighlights]);

  // Handle save word (create highlight + add to vocabulary/flashcards)
  const handleSaveWord = useCallback(async (
    text: string,
    translation: { translation: string; transliteration?: string; partOfSpeech?: string; definitions?: string[]; examples?: string[] }
  ) => {
    // First create highlight
    await handleAddNote(text, "", translation);

    // Add to vocabulary/flashcards
    const response = await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: text,
        language: content.language,
        translation: translation.translation,
        transliteration: translation.transliteration,
        partOfSpeech: translation.partOfSpeech,
        definitions: translation.definitions,
        ...(isLesson ? { lessonId: content.id } : { contentId: content.id }),
        contextSentence: (() => {
          if (!selection?.contextBefore) return text;
          const asianLanguages = ["chinese", "chinese_traditional", "chinese_simplified", "japanese", "korean", "thai", "vietnamese"];
          const contextLength = asianLanguages.includes(content.language.toLowerCase()) ? 15 : 30;
          return `...${selection.contextBefore.slice(-contextLength)} [${text}] ${selection.contextAfter?.slice(0, contextLength)}...`;
        })(),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const normalized = normalizeTerm(text);
      setFlashcardTerms((prev) => {
        const next = new Set(prev);
        next.add(normalized);
        return next;
      });
      if (result.message === "Word already in your vocabulary") {
        toast.info("Word already in your flashcards");
      } else {
        toast.success("Added to flashcards!");
      }
    } else {
      toast.error("Failed to add to flashcards");
    }
  }, [content.language, content.id, selection, handleAddNote, isLesson, normalizeTerm]);

  const handleAddLookupToFlashcards = useCallback(async (lookup: TranslationLookup) => {
    const sourceWord = lookup.source_text;
    const normalized = normalizeTerm(sourceWord);

    if (flashcardTerms.has(normalized)) {
      toast.info("Word already in your flashcards");
      return;
    }

    setAddingLookupId(lookup.id);

    try {
      const response = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: sourceWord,
          language: lookup.source_lang || content.language,
          translation: lookup.translated_text,
          transliteration: lookup.transliteration || undefined,
          ...(isLesson ? { lessonId: content.id } : { contentId: content.id }),
          contextSentence: lookup.source_text,
        }),
      });

      if (!response.ok) {
        toast.error("Failed to add to flashcards");
        return;
      }

      const result = await response.json();
      setFlashcardTerms((prev) => {
        const next = new Set(prev);
        next.add(normalized);
        return next;
      });

      if (result.message === "Word already in your vocabulary") {
        toast.info("Word already in your flashcards");
      } else {
        toast.success("Added to flashcards!");
      }
    } catch {
      toast.error("Failed to add to flashcards");
    } finally {
      setAddingLookupId(null);
    }
  }, [content.id, content.language, isLesson, flashcardTerms, normalizeTerm]);

  // Handle highlight delete
  const handleDeleteHighlight = useCallback(async (highlightId: string) => {
    const response = await fetch(`/api/highlights/${highlightId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      if (focusedHighlightId === highlightId) {
        setFocusedHighlightId(null);
      }
      toast.success("Highlight deleted");
    } else {
      toast.error("Failed to delete highlight");
    }
  }, [focusedHighlightId]);

  // Handle highlight click from sidebar or content - scroll to highlight and show glow
  const handleHighlightClick = useCallback((highlight: Highlight) => {
    // Save current scroll position from the actual scrollable container
    const scrollContainer = contentContainerRef.current;
    setSavedScrollPosition(scrollContainer ? scrollContainer.scrollTop : window.scrollY);

    // Focus the highlight (triggers scroll and glow in ContentRenderer)
    setFocusedHighlightId(highlight.id);
  }, []);

  // Clear focused highlight when clicking outside
  useEffect(() => {
    if (!focusedHighlightId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't clear if clicking on a highlight or sidebar highlight item
      if (
        target.closest('mark[data-highlight-id]') ||
        target.closest('[data-sidebar-highlight]')
      ) {
        return;
      }
      setFocusedHighlightId(null);
    };

    // Small delay to avoid clearing immediately from the same click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [focusedHighlightId]);

  // Handle returning to saved reading position
  const handleReturnToPosition = useCallback(() => {
    if (savedScrollPosition !== null) {
      const scrollContainer = contentContainerRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: savedScrollPosition, behavior: "smooth" });
      } else {
        window.scrollTo({ top: savedScrollPosition, behavior: "smooth" });
      }
      setSavedScrollPosition(null);
    }
  }, [savedScrollPosition]);

  // Handle lookup click
  const handleLookupClick = useCallback((lookup: TranslationLookup) => {
    // TODO: Show translation popup again
    console.log("Show lookup:", lookup);
  }, []);

  // Handle clear lookups
  const handleClearLookups = useCallback(async () => {
    const param = isLesson ? `lessonId=${content.id}` : `contentId=${content.id}`;
    const response = await fetch(`/api/translation-lookups?${param}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setLookups([]);
    }
  }, [content.id, isLesson]);

  // Handle remove single lookup
  const handleRemoveLookup = useCallback(async (id: string) => {
    const response = await fetch(`/api/translation-lookups?id=${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setLookups((prev) => prev.filter((l) => l.id !== id));
    }
  }, []);

  // Handle TOC item click
  const handleTOCClick = useCallback((id: string) => {
    // For HTML content, scroll to element
    if (!content.source_url?.endsWith('.epub')) {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
    // For EPUB, the href is handled internally by the EPUB renderer
  }, [content.source_url]);

  // Handle popover close
  const handlePopoverClose = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Handle RSVP mode toggle
  const toggleRSVP = useCallback(() => {
    setReaderMode((current) => (current === "rsvp" ? "default" : "rsvp"));
  }, []);

  const toggleKaraoke = useCallback(() => {
    if (!isArticleLikeContent) return;
    setReaderMode((current) => (current === "karaoke" ? "default" : "karaoke"));
  }, [isArticleLikeContent]);

  // Handle progress bar seek in RSVP mode
  const handleProgressSeek = useCallback((percentage: number) => {
    if (isKaraokeMode && karaokeSegments.length > 0) {
      const rawIndex = Math.round((percentage / 100) * (karaokeSegments.length - 1));
      setKaraokeSegmentIndex(
        Math.max(0, Math.min(karaokeSegments.length - 1, rawIndex))
      );
      return;
    }

    if (rsvpSeekFnRef.current) {
      rsvpSeekFnRef.current(percentage);
    }
  }, [isKaraokeMode, karaokeSegments.length]);

  const activeKaraokeSegment = karaokeSegments[karaokeSegmentIndex] ?? null;
  const handleKaraokeSegmentsChange = useCallback((segments: ReaderSegment[]) => {
    setKaraokeSegments((current) => {
      if (
        current.length === segments.length &&
        current.every((segment, index) => {
          const nextSegment = segments[index];
          return (
            segment.id === nextSegment?.id &&
            segment.startOffset === nextSegment.startOffset &&
            segment.endOffset === nextSegment.endOffset &&
            segment.text === nextSegment.text &&
            segment.startMs === nextSegment.startMs &&
            segment.endMs === nextSegment.endMs
          );
        })
      ) {
        return current;
      }

      return segments;
    });
  }, []);

  return (
    <>
      <ReaderLayout
        title={content.title}
        contentScrollRef={contentContainerRef}
        hideLeftSidebar={tocItems.length === 0}
        isRSVPMode={isRSVPMode}
        onToggleRSVP={toggleRSVP}
        isKaraokeMode={isKaraokeMode}
        isKaraokeAvailable={isArticleLikeContent}
        onToggleKaraoke={toggleKaraoke}
        modePanel={
          isKaraokeMode ? (
            <KaraokeReader
              segments={karaokeSegments}
              activeSegmentIndex={karaokeSegmentIndex}
              language={content.language}
              onActiveSegmentIndexChange={setKaraokeSegmentIndex}
            />
          ) : null
        }
        requestRightOpen={focusedHighlightId}
        leftSidebar={
          <TableOfContents
            items={tocItems}
            onItemClick={handleTOCClick}
          />
        }
        rightSidebar={
          <RightSidebar
            highlights={highlights}
            lookups={lookups}
            flashcardTerms={flashcardTerms}
            addingLookupId={addingLookupId}
            progress={displayProgress}
            wordsRead={displayWordsRead}
            totalWords={displayTotalWords}
            timeRemaining={displayTimeRemaining}
            isProgressInteractive={isRSVPMode || isKaraokeMode}
            onProgressSeek={handleProgressSeek}
            focusedHighlightId={focusedHighlightId}
            onHighlightClick={handleHighlightClick}
            onDeleteHighlight={handleDeleteHighlight}
            onLookupClick={handleLookupClick}
            onAddLookupToFlashcards={handleAddLookupToFlashcards}
            onClearLookups={handleClearLookups}
            onRemoveLookup={handleRemoveLookup}
          />
        }
        bookmarkButton={
          <BookmarkButton
            itemType={isLesson ? "lesson" : "content"}
            itemId={content.id}
          />
        }
        audioPlayer={
          <AudioPlayer
            contentId={content.id}
            lessonId={isLesson ? content.id : undefined}
            language={content.language}
          />
        }
        >
        {isRSVPMode ? (
          <RSVPReader
            text={plainTextContent}
            language={content.language}
            initialPosition={rsvpWordIndex}
            onPositionChange={(index, totalWords) => {
              setRsvpWordIndex(index);
              setRsvpTotalWords(totalWords);
            }}
            onWpmChange={(wpm) => {
              setRsvpWpm(wpm);
            }}
            onRegisterSeek={(seekFn) => {
              rsvpSeekFnRef.current = seekFn;
            }}
          />
        ) : (
          <ContentRenderer
            content={content}
            highlights={highlights}
            focusedHighlightId={focusedHighlightId}
            currentSelection={selection}
            readerMode={readerMode}
            activeReaderSegmentId={activeKaraokeSegment?.id ?? null}
            onSelection={handleSelection}
            onTocUpdate={handleEpubTocUpdate}
            onHighlightClick={handleHighlightClick}
            onReaderSegmentsChange={handleKaraokeSegmentsChange}
            onReaderSegmentSelect={(segment) => {
              const nextIndex = karaokeSegments.findIndex(
                (candidate) => candidate.id === segment.id
              );
              if (nextIndex >= 0) {
                setKaraokeSegmentIndex(nextIndex);
              }
            }}
          />
        )}
      </ReaderLayout>

      <AnimatePresence mode="wait">
        {selection && (
          <TranslatePopover
            key={selection.text + selection.startOffset}
            selection={selection}
            position={popoverPosition}
            onTranslate={handleTranslate}
            onAddNote={handleAddNote}
            onSaveWord={handleSaveWord}
            onClose={handlePopoverClose}
          />
        )}
      </AnimatePresence>

      {/* Back to reading position button */}
      {savedScrollPosition !== null && (
        <Button
          onClick={handleReturnToPosition}
          className="fixed bottom-6 right-6 z-50 shadow-lg"
          size="sm"
        >
          <ArrowDown className="mr-2 h-4 w-4" />
          Back to reading
        </Button>
      )}
    </>
  );
}
