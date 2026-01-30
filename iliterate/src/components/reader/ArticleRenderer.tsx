"use client";

import { useCallback, useEffect, useState } from "react";
import { Highlight, TranslationLookup, Content } from "@/types/database";
import { TextSelection } from "./TextHighlighter";
import { TranslatePopover } from "./TranslatePopover";
import { ReaderLayout } from "./ReaderLayout";
import { TableOfContents } from "./TableOfContents";
import { RightSidebar } from "./RightSidebar";
import { ContentRenderer } from "./ContentRenderer";
import { useReadingProgress } from "./useReadingProgress";
import { AudioPlayer } from "./AudioPlayer";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface TOCItem {
  id: string;
  title: string;
  level: number;
}

interface ArticleRendererProps {
  content: Content;
}

export function ArticleRenderer({ content }: ArticleRendererProps) {
  const supabase = createClient();

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [lookups, setLookups] = useState<TranslationLookup[]>([]);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [epubToc, setEpubToc] = useState<Array<{ label: string; href: string }>>([]);

  // Reading progress tracking
  const {
    progress,
    wordsRead,
    getTimeRemaining,
  } = useReadingProgress({
    contentId: content.id,
    wordCount: content.word_count || 1000,
  });

  const timeRemaining = getTimeRemaining(200); // Default 200 WPM

  // Load highlights and lookups on mount
  useEffect(() => {
    loadHighlights();
    loadLookups();
    generateTOC();
  }, [content.id]);

  const loadHighlights = async () => {
    const response = await fetch(`/api/highlights?contentId=${content.id}`);
    if (response.ok) {
      const data = await response.json();
      setHighlights(data);
    }
  };

  const loadLookups = async () => {
    const response = await fetch(`/api/translation-lookups?contentId=${content.id}`);
    if (response.ok) {
      const data = await response.json();
      setLookups(data);
    }
  };

  // Generate TOC from content headings (for HTML content)
  const generateTOC = () => {
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
  };

  // Handle text selection from any content type
  const handleSelection = useCallback((sel: TextSelection | null) => {
    setSelection(sel);
    if (sel) {
      const rect = sel.range.getBoundingClientRect();
      setPopoverPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    }
  }, []);

  // Handle EPUB TOC updates
  const handleEpubTocUpdate = useCallback((toc: Array<{ label: string; href: string }>) => {
    setEpubToc(toc);
    // Convert EPUB TOC to our format
    const items: TOCItem[] = toc.map((item, index) => ({
      id: item.href,
      title: item.label,
      level: 1,
    }));
    setTocItems(items);
  }, []);

  // Handle translate
  const handleTranslate = async (text: string) => {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sourceLang: content.language,
        targetLang: "en", // TODO: Get from user profile
        contextBefore: selection?.contextBefore,
        contextAfter: selection?.contextAfter,
        contentId: content.id,
      }),
    });

    if (!response.ok) {
      throw new Error("Translation failed");
    }

    const result = await response.json();

    // Refresh lookups
    await loadLookups();

    return result;
  };

  // Handle add note
  const handleAddNote = async (
    text: string,
    note: string,
    translation?: { translation: string; transliteration?: string; partOfSpeech?: string }
  ) => {
    if (!selection) return;

    const response = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId: content.id,
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
  };

  // Handle save word (create highlight + add to vocabulary/flashcards)
  const handleSaveWord = async (
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
        contentId: content.id,
        contextSentence: selection?.contextBefore
          ? `...${selection.contextBefore.slice(-30)} [${text}] ${selection.contextAfter?.slice(0, 30)}...`
          : text,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.message === "Word already in your vocabulary") {
        toast.info("Word already in your flashcards");
      } else {
        toast.success("Added to flashcards!");
      }
    } else {
      toast.error("Failed to add to flashcards");
    }
  };

  // Handle highlight click (scroll to position)
  const handleHighlightClick = (highlight: Highlight) => {
    // TODO: Scroll to position and show in context
    console.log("Scroll to highlight:", highlight);
  };

  // Handle lookup click
  const handleLookupClick = (lookup: TranslationLookup) => {
    // TODO: Show translation popup again
    console.log("Show lookup:", lookup);
  };

  // Handle clear lookups
  const handleClearLookups = async () => {
    const response = await fetch(`/api/translation-lookups?contentId=${content.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setLookups([]);
    }
  };

  // Handle remove single lookup
  const handleRemoveLookup = async (id: string) => {
    const response = await fetch(`/api/translation-lookups?id=${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setLookups((prev) => prev.filter((l) => l.id !== id));
    }
  };

  // Handle TOC item click
  const handleTOCClick = (id: string) => {
    // For HTML content, scroll to element
    if (!content.source_url?.endsWith('.epub')) {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
    // For EPUB, the href is handled internally by the EPUB renderer
  };

  return (
    <>
      <ReaderLayout
        title={content.title}
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
            progress={progress}
            wordsRead={wordsRead}
            totalWords={content.word_count || 1000}
            timeRemaining={timeRemaining}
            onHighlightClick={handleHighlightClick}
            onLookupClick={handleLookupClick}
            onClearLookups={handleClearLookups}
            onRemoveLookup={handleRemoveLookup}
          />
        }
        audioPlayer={
          <AudioPlayer
            text={content.body.replace(/<[^>]*>/g, "")} // Strip HTML tags
            language={content.language}
          />
        }
      >
        <ContentRenderer
          content={content}
          onSelection={handleSelection}
          onTocUpdate={handleEpubTocUpdate}
        />
      </ReaderLayout>

      {selection && (
        <TranslatePopover
          selection={selection}
          position={popoverPosition}
          onTranslate={handleTranslate}
          onAddNote={handleAddNote}
          onSaveWord={handleSaveWord}
          onClose={() => {
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
    </>
  );
}
