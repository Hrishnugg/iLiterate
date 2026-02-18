"use client";

import { useState, useEffect, useCallback } from "react";
import { FlashcardCard, FlashcardData } from "./FlashcardCard";
import { ReviewButtons, ResponseQuality } from "./ReviewButtons";
import { ReviewProgress } from "./ReviewProgress";
import { UpgradePrompt } from "./UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, PartyPopper, X } from "lucide-react";

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

  const handleResponse = async (response: ResponseQuality) => {
    if (!reviewState || isSubmitting) return;

    const currentCard = reviewState.cards[currentIndex];
    if (!currentCard) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/vocabulary/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: currentCard.id,
          response,
        }),
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

      // Update state
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

      // Move to next card
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={fetchCards}>Try Again</Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!reviewState) return null;

  // No cards due
  if (reviewState.cards.length === 0 && !reviewState.limitReached) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <PartyPopper className="h-12 w-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground mb-4">
              No cards are due for review right now. Check back later!
            </p>
            <Button onClick={onClose}>Done</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Limit reached (paywall)
  if (reviewState.limitReached) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <UpgradePrompt
          dailyReviewsUsed={reviewState.dailyReviewsUsed}
          dailyLimit={reviewState.dailyLimit}
          onClose={onClose}
        />
      </div>
    );
  }

  // All cards completed
  if (currentIndex >= reviewState.cards.length) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <PartyPopper className="h-12 w-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Session Complete!</h3>
            <p className="text-muted-foreground mb-4">
              You reviewed {completedCount} cards.
              {!reviewState.isPremium && (
                <span className="block mt-1">
                  {reviewState.remainingReviews} reviews remaining today.
                </span>
              )}
            </p>
            <Button onClick={onClose}>Done</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentCard = reviewState.cards[currentIndex];

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <h2 className="font-semibold">Review Session</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress */}
      <div className="p-4 flex-shrink-0">
        <ReviewProgress
          completed={completedCount}
          total={reviewState.cards.length}
          remainingReviews={reviewState.remainingReviews}
          isPremium={reviewState.isPremium}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <FlashcardCard
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={handleFlip}
        />
      </div>

      {/* Review Buttons */}
      <div className="p-4 border-t flex-shrink-0">
        {isFlipped ? (
          <ReviewButtons
            intervalPreview={currentCard.intervalPreview}
            onResponse={handleResponse}
            disabled={isSubmitting}
          />
        ) : (
          <div className="h-[68px]" /> // Placeholder to prevent layout shift
        )}
      </div>
    </div>
  );
}
