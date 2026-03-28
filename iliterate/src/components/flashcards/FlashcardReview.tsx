"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FlashcardCard, FlashcardData } from "./FlashcardCard";
import { ReviewButtons, ResponseQuality } from "./ReviewButtons";
import { UpgradePrompt } from "./UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Loader2, PartyPopper, X } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/I18nProvider";

interface ReviewState {
  cards: FlashcardData[];
  totalDue: number;
  limitReached: boolean;
  dailyReviewsUsed: number;
  dailyLimit: number;
  remainingReviews: number;
  isPremium: boolean;
}

interface FlashcardReviewProps {
  onClose: () => void;
}

export function FlashcardReview({ onClose }: FlashcardReviewProps) {
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const t = useT();

  const fetchCards = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/vocabulary/review");
      if (!response.ok) throw new Error("Failed to fetch cards");
      const data = await response.json();
      setReviewState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleResponse = useCallback(
    async (response: ResponseQuality) => {
      if (!reviewState || isSubmitting) return;

      const currentCard = reviewState.cards[currentIndex];
      if (!currentCard) return;

      try {
        setIsSubmitting(true);
        const res = await fetch("/api/vocabulary/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: currentCard.id, response }),
        });

        if (!res.ok) {
          const data = await res.json();
          if (data.limitReached) {
            setReviewState((prev) =>
              prev ? { ...prev, limitReached: true } : null
            );
            return;
          }
          throw new Error(data.error || "Failed to submit review");
        }

        const result = await res.json();

        setCompletedCount((prev) => prev + 1);
        setReviewState((prev) =>
          prev
            ? {
                ...prev,
                dailyReviewsUsed: result.dailyReviewsUsed,
                remainingReviews: result.remainingReviews,
                limitReached: result.limitReached,
              }
            : null
        );

        setIsFlipped(false);
        setCurrentIndex((prev) => prev + 1);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to submit review"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [reviewState, currentIndex, isSubmitting]
  );

  const handleFlip = useCallback(() => {
    setIsFlipped(true);
  }, []);

  // Keyboard shortcuts
  const isActiveReview =
    !isLoading &&
    !error &&
    reviewState &&
    !reviewState.limitReached &&
    currentIndex < reviewState.cards.length;

  const shortcuts = useMemo(
    () => ({
      " ": () => {
        if (!isFlipped) handleFlip();
      },
      "1": () => {
        if (isFlipped && !isSubmitting) handleResponse("again");
      },
      "2": () => {
        if (isFlipped && !isSubmitting) handleResponse("hard");
      },
      "3": () => {
        if (isFlipped && !isSubmitting) handleResponse("good");
      },
      "4": () => {
        if (isFlipped && !isSubmitting) handleResponse("easy");
      },
      Escape: onClose,
    }),
    [isFlipped, isSubmitting, handleFlip, handleResponse, onClose]
  );

  useKeyboardShortcuts(shortcuts, !!isActiveReview);

  // Loading state — zen
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={fetchCards}>
              {t("flashcards.tryAgain")}
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              {t("flashcards.close")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!reviewState) return null;

  // No cards due — celebration
  if (reviewState.cards.length === 0 && !reviewState.limitReached) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <PartyPopper className="size-12 text-primary" />
          <h3 className="text-xl font-semibold tracking-tight">
            {t("flashcards.allCaughtUpTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("flashcards.noDueCards")}
          </p>
          <Button onClick={onClose}>{t("flashcards.done")}</Button>
        </div>
      </div>
    );
  }

  // Limit reached
  if (reviewState.limitReached) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <UpgradePrompt
          dailyReviewsUsed={reviewState.dailyReviewsUsed}
          dailyLimit={reviewState.dailyLimit}
          onClose={onClose}
        />
      </div>
    );
  }

  // Session complete — celebration
  if (currentIndex >= reviewState.cards.length) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <PartyPopper className="size-12 text-primary" />
          <h3 className="text-xl font-semibold tracking-tight">
            {t("flashcards.sessionComplete")}
          </h3>
          <p className="font-mono text-5xl font-bold tracking-tighter text-primary">
            {completedCount}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("flashcards.cardsReviewed")}
            {!reviewState.isPremium && (
              <span className="block mt-1">
                {t("flashcards.reviewsRemaining").replace("{count}", String(reviewState.remainingReviews))}
              </span>
            )}
          </p>
          <Button onClick={onClose}>{t("flashcards.done")}</Button>
        </div>
      </div>
    );
  }

  const currentCard = reviewState.cards[currentIndex];
  const progress =
    reviewState.cards.length > 0
      ? (completedCount / reviewState.cards.length) * 100
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Floating progress pill + close button */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-6 pt-6">
        <div />
        <div className="flex items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-sm">
          <span className="font-mono text-xs font-medium">
            {completedCount + 1} / {reviewState.cards.length}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Card — fills the center */}
      <div className="flex flex-1 items-center justify-center px-6">
        <FlashcardCard
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={handleFlip}
        />
      </div>

      {/* Review buttons dock at bottom */}
      <div
        className={cn(
          "flex-shrink-0 px-6 pb-8 pt-4 transition-opacity duration-200",
          isFlipped ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <ReviewButtons
          intervalPreview={currentCard.intervalPreview}
          onResponse={handleResponse}
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
}
