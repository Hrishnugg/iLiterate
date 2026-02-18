"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeckProps {
  contentId: string;
  contentTitle?: string;
}

interface VocabularyItem {
  word: string;
  pronunciation: string | null;
  definitions: { translation?: string; definitions?: string[] } | null;
  part_of_speech: string | null;
}

interface FlashcardItem {
  id: string;
  context_sentence: string | null;
  vocabulary: VocabularyItem;
}

export function Deck({ contentId, contentTitle }: DeckProps) {
  const [cards, setCards] = useState<FlashcardItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCards() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/vocabulary?contentId=${contentId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch vocabulary");
        }

        const data: FlashcardItem[] = await response.json();
        setCards(data.filter((item) => item.vocabulary?.word));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadCards();
  }, [contentId]);

  const goToPrev = () => {
    setIsFlipped(false);
    setCurrent((i) => Math.max(0, i - 1));
  };

  const goToNext = () => {
    setIsFlipped(false);
    setCurrent((i) => Math.min(cards.length - 1, i + 1));
  };

  const getTranslation = (vocab: VocabularyItem) => {
    if (vocab.definitions?.translation) return vocab.definitions.translation;
    if (vocab.definitions?.definitions?.[0]) return vocab.definitions.definitions[0];
    return "No translation";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading flashcards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No flashcards found</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            No vocabulary has been saved from this book yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentCard = cards[current];
  const vocab = currentCard.vocabulary;

  return (
    <div className="flex flex-col items-center space-y-6">
      {contentTitle && (
        <p className="text-muted-foreground">{contentTitle}</p>
      )}

      {/* Flip card */}
      <div
        className="w-full max-w-xl cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped(!isFlipped)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsFlipped(!isFlipped);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div
          className="relative transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <Card
            className={cn(
              "min-h-[300px]",
              isFlipped && "invisible"
            )}
            style={{ backfaceVisibility: "hidden" }}
          >
            <CardContent className="flex flex-col items-center justify-center min-h-[300px] p-8">
              <h2 className="text-4xl font-bold text-center mb-4">{vocab.word}</h2>
              {vocab.pronunciation && (
                <p className="text-lg text-muted-foreground mb-4">
                  {vocab.pronunciation}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Click to reveal</p>
            </CardContent>
          </Card>

          {/* Back */}
          <Card
            className={cn(
              "min-h-[300px] absolute inset-0",
              !isFlipped && "invisible"
            )}
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardContent className="flex flex-col items-center justify-center min-h-[300px] p-8">
              <h2 className="text-2xl font-bold text-center mb-2">{vocab.word}</h2>
              {vocab.pronunciation && (
                <p className="text-muted-foreground mb-3">{vocab.pronunciation}</p>
              )}
              <p className="text-2xl font-semibold text-primary mb-3 text-center">
                {getTranslation(vocab)}
              </p>
              {vocab.part_of_speech && (
                <span className="text-sm bg-muted px-3 py-1 rounded-full mb-3">
                  {vocab.part_of_speech}
                </span>
              )}
              {currentCard.context_sentence && (
                <p className="text-sm text-muted-foreground italic text-center max-w-md mt-2">
                  &ldquo;{currentCard.context_sentence}&rdquo;
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrev}
          disabled={current === 0}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[80px] text-center">
          {current + 1} / {cards.length}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={goToNext}
          disabled={current === cards.length - 1}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-muted-foreground">
        Press Space or Enter to flip, or click the card
      </p>
    </div>
  );
}
