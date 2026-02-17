"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, BookOpen, Trash2, Search } from "lucide-react";
import Link from "next/link";

interface VocabularyItem {
  id: string;
  word: string;
  language: string;
  pronunciation: string | null;
  definitions: { translation?: string; definitions?: string[] };
  part_of_speech: string | null;
}

interface UserVocabulary {
  id: string;
  vocabulary_id: string;
  content_id: string | null;
  lesson_id: string | null;
  context_sentence: string | null;
  created_at: string;
  vocabulary: VocabularyItem;
}

export default function AllFlashcardsPage() {
  const [flashcards, setFlashcards] = useState<UserVocabulary[]>([]);
  const [filteredCards, setFilteredCards] = useState<UserVocabulary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchFlashcards = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/vocabulary");
      if (!response.ok) throw new Error("Failed to fetch flashcards");
      const data = await response.json();
      setFlashcards(data);
      setFilteredCards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flashcards");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCards(flashcards);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCards(
        flashcards.filter(
          (item) =>
            item.vocabulary.word.toLowerCase().includes(query) ||
            getTranslation(item.vocabulary).toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, flashcards]);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/vocabulary/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setFlashcards((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete flashcard:", err);
    }
  };

  const getTranslation = (vocab: VocabularyItem) => {
    if (vocab.definitions?.translation) return vocab.definitions.translation;
    if (vocab.definitions?.definitions?.[0]) return vocab.definitions.definitions[0];
    return "No translation";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
        <Button onClick={fetchFlashcards} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Flashcards</h1>
          <p className="text-muted-foreground mt-1">
            {flashcards.length} words saved
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search words..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {flashcards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">No flashcards yet</h3>
            <p className="text-muted-foreground mb-4">
              Start reading and save words to create flashcards
            </p>
            <Button asChild>
              <Link href="/lesson-plan">Start a Lesson</Link>
            </Button>
          </CardContent>
        </Card>
      ) : filteredCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">No matches found</h3>
            <p className="text-muted-foreground">
              Try a different search term
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((item) => (
            <Card key={item.id} className="relative group">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">
                      {item.vocabulary.word}
                    </h3>
                    {item.vocabulary.pronunciation && (
                      <p className="text-sm text-muted-foreground">
                        {item.vocabulary.pronunciation}
                      </p>
                    )}
                  </div>
                  {item.vocabulary.part_of_speech && (
                    <span className="text-xs bg-muted px-2 py-1 rounded ml-2">
                      {item.vocabulary.part_of_speech}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-primary font-medium">
                  {getTranslation(item.vocabulary)}
                </p>

                {item.context_sentence && (
                  <p className="mt-2 text-sm text-muted-foreground italic truncate">
                    &ldquo;{item.context_sentence}&rdquo;
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
