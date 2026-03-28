"use client";

import { useEffect, useState } from "react";
import { useT, T } from "@/lib/i18n/I18nProvider";
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
  const t = useT();

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
      <h1 className="text-2xl font-bold"><T id="flashcards.title" /></h1>
      <p className="mt-1 text-sm text-muted-foreground">
        <T id="flashcards.subtitle" />
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6 items-stretch">
        {/* Start Review Card - Primary action */}
        <Card className="h-full border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <T id="flashcards.startReview" />
              </CardTitle>
              {!isLoadingDue && dueCount !== null && dueCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full">
                  <T id="flashcards.dueCount" values={{ count: String(dueCount) }} />
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p>
              {isLoadingDue ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <T id="flashcards.checkingDue" />
                </span>
              ) : dueCount === 0 ? (
                <T id="flashcards.noDue" />
              ) : dueCount === 1 ? (
                <T id="flashcards.oneCardReady" />
              ) : (
                <T id="flashcards.cardsReady" values={{ count: String(dueCount) }} />
              )}
            </p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button
              className="w-full"
              onClick={() => setShowReview(true)}
              disabled={isLoadingDue || dueCount === 0}
            >
              <T id="flashcards.startReview" />
            </Button>
          </CardFooter>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <T id="flashcards.viewFlashcards" />
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p><T id="flashcards.viewFlashcardsDesc" /></p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button asChild className="w-full" variant="outline">
              <Link href="/all"><T id="common.viewAll" /></Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg"><T id="flashcards.createNew" /></CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p><T id="flashcards.createNewDesc" /></p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button asChild className="w-full" variant="outline">
              <Link href="/create">
                <Plus className="h-4 w-4 mr-2" />
                <T id="common.create" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
