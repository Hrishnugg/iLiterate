"use client";

import { useState, useEffect } from "react";
import { FlashCard, Flashcard } from "./Flashcard";
import { Button } from "../ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface DeckProps {
  contentId: string;
  contentTitle?: string;
}

interface LookupResponse {
  id: string;
  selected_text: string;
  translation: string;
  created_at: string;
}

export function Deck({ contentId, contentTitle }: DeckProps) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let vocabCards: Flashcard[] = [];

        try {
          const vocabRes = await fetch(
            `/api/vocabulary?contentId=${contentId}`,
            { credentials: "include" }
          );
          if (vocabRes.ok) {
            const vocabData: any[] = await vocabRes.json();
            vocabCards = (vocabData
              .map((item) => {
                const front = item.vocabulary?.word || "";
                if (!front) return null;

                let translationText = "";
                const defs = item.vocabulary?.definitions;
                if (defs) {
                  if (typeof defs === "object" && "translation" in defs) {
                    translationText = defs.translation;
                  } else if (
                    typeof defs === "object" &&
                    Array.isArray(defs.definitions)
                  ) {
                    translationText = defs.definitions.join(", ");
                  }
                }

                const pronunciation = item.vocabulary?.pronunciation;

                const back = (
                  <>
                    <div>{translationText}</div>
                    {pronunciation && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {pronunciation}
                      </div>
                    )}
                  </>
                );

                return {
                  id: item.id,
                  front,
                  back,
                };
              })
              .filter(Boolean) as Flashcard[]);
          } else {
            const body = await vocabRes.json().catch(() => null);
            console.warn("vocab fetch failed", vocabRes.status, body);
          }
        } catch (e) {
          console.warn("vocab request error", e);
        }

        console.log("vocabCards count", vocabCards.length, vocabCards);
        const combined = [...vocabCards];
        const unique = combined.filter(Boolean) as Flashcard[];
        console.log("unique count", unique.length, unique);
        setCards(unique);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [contentId]);

  const prev = () => setCurrent((i) => Math.max(0, i - 1));
  const next = () => setCurrent((i) => Math.min(cards.length - 1, i + 1));

  if (loading) {
    return <p>Loading deck…</p>;
  }
  if (error) {
    return <p className="text-destructive">{error}</p>;
  }
  if (cards.length === 0) {
    return (
      <div>
        <p>No flashcards found for this book.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {contentTitle && <h2 className="text-xl font-semibold">{contentTitle}</h2>}

      <FlashCard card={cards[current]} />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={prev} disabled={current === 0}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm">
          {current + 1} / {cards.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={next}
          disabled={current === cards.length - 1}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
