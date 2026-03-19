"use client";

import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWordAudio } from "@/lib/tts/use-word-audio";

interface VocabularyItem {
  id: string;
  word: string;
  language: string;
  pronunciation: string | null;
  definitions: { translation?: string; definitions?: string[] };
  part_of_speech: string | null;
}

interface FlashcardData {
  id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  times_reviewed: number;
  times_correct: number;
  context_sentence: string | null;
  vocabulary: VocabularyItem;
  intervalPreview: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
}

interface FlashcardCardProps {
  card: FlashcardData;
  isFlipped: boolean;
  onFlip: () => void;
}

export function FlashcardCard({
  card,
  isFlipped,
  onFlip,
}: FlashcardCardProps) {
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const { play, loading: audioLoading } = useWordAudio();

  const vocab = card.vocabulary;

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    play(vocab.word, vocab.language);
  };

  const getTranslation = () => {
    if (vocab.definitions?.translation) return vocab.definitions.translation;
    if (vocab.definitions?.definitions?.[0])
      return vocab.definitions.definitions[0];
    return "No translation";
  };

  const handleCardClick = () => {
    if (!isFlipped) onFlip();
  };

  return (
    <div className="perspective-1000 w-full max-w-lg">
      <div
        className={cn(
          "relative cursor-pointer transition-transform duration-500"
        )}
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
        onClick={handleCardClick}
      >
        {/* Front */}
        <div
          className={cn(
            "flex min-h-[360px] flex-col items-center justify-center rounded-lg border bg-card p-10",
            isFlipped && "invisible"
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="font-mono text-5xl font-semibold tracking-tight">
            {vocab.word}
          </span>

          <button
            onClick={handleSpeak}
            disabled={audioLoading}
            className="mt-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label={`Listen to pronunciation of ${vocab.word}`}
          >
            {audioLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Volume2 className="size-3.5" />
            )}
            Listen
          </button>

          {/* Pronunciation — tap to reveal */}
          {vocab.pronunciation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPronunciation(!showPronunciation);
              }}
              className="mt-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPronunciation ? vocab.pronunciation : "Show pronunciation"}
            </button>
          )}

          {/* Divider */}
          <div className="my-5 h-px w-12 bg-border" />

          {/* Context sentence hint */}
          {card.context_sentence && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowHint(!showHint);
              }}
              className="max-w-sm text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {showHint ? (
                <span className="italic">{card.context_sentence}</span>
              ) : (
                "Show context"
              )}
            </button>
          )}

          {vocab.part_of_speech && (
            <span className="mt-4 rounded bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {vocab.part_of_speech}
            </span>
          )}

          {/* Tap hint */}
          <p className="mt-8 text-xs text-muted-foreground/50">
            Tap or press Space to reveal
          </p>
        </div>

        {/* Back */}
        <div
          className={cn(
            "absolute inset-0 flex min-h-[360px] flex-col items-center justify-center rounded-lg border bg-card p-10",
            !isFlipped && "invisible"
          )}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-3xl font-semibold tracking-tight">
              {vocab.word}
            </span>
            <button
              onClick={handleSpeak}
              disabled={audioLoading}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              aria-label={`Listen to pronunciation of ${vocab.word}`}
            >
              {audioLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
          </div>

          {vocab.pronunciation && (
            <span className="mt-2 text-sm text-muted-foreground">
              {vocab.pronunciation}
            </span>
          )}

          <div className="my-4 h-px w-12 bg-border" />

          <span className="text-2xl font-semibold text-primary">
            {getTranslation()}
          </span>

          {vocab.part_of_speech && (
            <span className="mt-3 rounded bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {vocab.part_of_speech}
            </span>
          )}

          {vocab.definitions?.definitions &&
            vocab.definitions.definitions.length > 1 && (
              <div className="mt-3 max-w-sm text-center text-sm text-muted-foreground">
                {vocab.definitions.definitions.slice(1, 3).map((def, i) => (
                  <p key={i}>{def}</p>
                ))}
              </div>
            )}

          {card.context_sentence && (
            <p className="mt-4 max-w-sm text-center text-xs italic text-muted-foreground">
              {card.context_sentence}
            </p>
          )}

          <span className="mt-6 text-[10px] text-muted-foreground/50">
            Reviewed {card.times_reviewed}x ({card.times_correct} correct)
          </span>
        </div>
      </div>
    </div>
  );
}

export type { FlashcardData };
