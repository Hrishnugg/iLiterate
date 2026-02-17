"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, BookOpen, Clock, Loader2 } from "lucide-react";
import { FlashcardReview } from "@/components/flashcards/FlashcardReview";

export default function FlashcardsPage() {
  const [showReview, setShowReview] = useState(false);
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [isLoadingDue, setIsLoadingDue] = useState(true);

  useEffect(() => {
    const fetchDueCount = async () => {
      try {
        const response = await fetch("/api/vocabulary/review");
        if (response.ok) {
          const data = await response.json();
          setDueCount(data.totalDue);
        }
      } catch (err) {
        console.error("Failed to fetch due count:", err);
      } finally {
        setIsLoadingDue(false);
      }
    };

    fetchDueCount();
  }, []);

  if (showReview) {
    return <FlashcardReview onClose={() => setShowReview(false)} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Flashcards</h1>
      <p className="text-muted-foreground mt-2">
        Review your saved vocabulary.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-10 items-stretch">
        {/* Start Review Card - Primary action */}
        <Card className="h-full border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Start Review
              </CardTitle>
              {!isLoadingDue && dueCount !== null && dueCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full">
                  {dueCount} due
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p>
              {isLoadingDue ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking due cards...
                </span>
              ) : dueCount === 0 ? (
                "No cards due for review right now."
              ) : dueCount === 1 ? (
                "1 card is ready for review."
              ) : (
                `${dueCount} cards are ready for review.`
              )}
            </p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button
              className="w-full"
              onClick={() => setShowReview(true)}
              disabled={isLoadingDue || dueCount === 0}
            >
              Start Review
            </Button>
          </CardFooter>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                View Flashcards
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p>Look at all the new words you&apos;ve learned so far!</p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button asChild className="w-full" variant="outline">
              <Link href="/all">View All</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">Create New Flashcard</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p>Create your own flashcard for a term!</p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button asChild className="w-full" variant="outline">
              <Link href="/create">
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
