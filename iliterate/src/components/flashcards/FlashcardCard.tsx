"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function FlashcardCard({ card, isFlipped, onFlip }: FlashcardCardProps) {
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const vocab = card.vocabulary;

  const getTranslation = () => {
    if (vocab.definitions?.translation) return vocab.definitions.translation;
    if (vocab.definitions?.definitions?.[0]) return vocab.definitions.definitions[0];
    return "No translation";
  };

  const handleCardClick = () => {
    if (!isFlipped) {
      onFlip();
    }
  };

  const handlePronunciationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPronunciation(!showPronunciation);
  };

  const handleHintClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowHint(!showHint);
  };

  return (
    <div className="perspective-1000 w-full max-w-xl mx-auto">
      <div
        className={cn(
          "relative transition-transform duration-500 transform-style-3d cursor-pointer",
          isFlipped && "rotate-y-180"
        )}
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
        onClick={handleCardClick}
      >
        {/* Front of card */}
        <Card
          className={cn(
            "min-h-[400px] backface-hidden",
            isFlipped && "invisible"
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <h2 className="text-4xl font-bold text-center mb-4">{vocab.word}</h2>

            {/* Hint buttons */}
            <div className="flex gap-2 mb-6">
              {vocab.pronunciation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePronunciationClick}
                  className="gap-2"
                >
                  <Volume2 className="h-4 w-4" />
                  Pronunciation
                </Button>
              )}
              {card.context_sentence && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHintClick}
                  className="gap-2"
                >
                  <Lightbulb className="h-4 w-4" />
                  Hint
                </Button>
              )}
            </div>

            {/* Pronunciation hint */}
            {showPronunciation && vocab.pronunciation && (
              <p className="text-lg text-muted-foreground mb-2">
                {vocab.pronunciation}
              </p>
            )}

            {/* Context hint */}
            {showHint && card.context_sentence && (
              <p className="text-sm text-muted-foreground italic text-center max-w-xs">
                &ldquo;{card.context_sentence}&rdquo;
              </p>
            )}

            <Button variant="default" className="mt-6" onClick={onFlip}>
              Show Answer
            </Button>
          </CardContent>
        </Card>

        {/* Back of card */}
        <Card
          className={cn(
            "min-h-[400px] absolute inset-0 backface-hidden",
            !isFlipped && "invisible"
          )}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <CardContent className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <h2 className="text-3xl font-bold text-center mb-2">{vocab.word}</h2>

            {vocab.pronunciation && (
              <p className="text-lg text-muted-foreground mb-3">
                {vocab.pronunciation}
              </p>
            )}

            <p className="text-2xl font-semibold text-primary mb-3 text-center">
              {getTranslation()}
            </p>

            {vocab.part_of_speech && (
              <span className="text-sm bg-muted px-3 py-1 rounded-full mb-3">
                {vocab.part_of_speech}
              </span>
            )}

            {vocab.definitions?.definitions && vocab.definitions.definitions.length > 1 && (
              <div className="text-sm text-muted-foreground mb-3 text-center max-w-md">
                {vocab.definitions.definitions.slice(1, 3).map((def, i) => (
                  <p key={i}>{def}</p>
                ))}
              </div>
            )}

            {card.context_sentence && (
              <p className="text-sm text-muted-foreground italic text-center max-w-md mt-2">
                &ldquo;{card.context_sentence}&rdquo;
              </p>
            )}

            <div className="mt-4 text-xs text-muted-foreground">
              Reviewed {card.times_reviewed} times ({card.times_correct} correct)
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export type { FlashcardData };
