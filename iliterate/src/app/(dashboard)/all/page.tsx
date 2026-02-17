"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, BookOpen, Trash2, Search, Calendar, Library } from "lucide-react";
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
  content?: { id: string; title: string } | null;
}

interface ContentOption {
  id: string;
  title: string;
}

type TimeFilter = "all" | "24h" | "7d" | "30d";

export default function AllFlashcardsPage() {
  const [flashcards, setFlashcards] = useState<UserVocabulary[]>([]);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [bookFilter, setBookFilter] = useState<string>("all");

  const fetchFlashcards = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/vocabulary");
      if (!response.ok) throw new Error("Failed to fetch flashcards");
      const data: UserVocabulary[] = await response.json();
      setFlashcards(data);

      // Extract unique content IDs and fetch their titles
      const contentIds = [...new Set(data.map((item) => item.content_id).filter(Boolean))] as string[];
      if (contentIds.length > 0) {
        const contentResponse = await fetch(`/api/content/batch?ids=${contentIds.join(",")}`);
        if (contentResponse.ok) {
          const contents = await contentResponse.json();
          setContentOptions(contents);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flashcards");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();
  }, []);

  // Filter cards by time, book, and search query
  const filteredCards = useMemo(() => {
    let filtered = flashcards;

    // Apply book filter
    if (bookFilter !== "all") {
      filtered = filtered.filter((item) => item.content_id === bookFilter);
    }

    // Apply time filter
    if (timeFilter !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (timeFilter) {
        case "24h":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      filtered = filtered.filter(
        (item) => new Date(item.created_at) >= cutoffDate
      );
    }

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.vocabulary.word.toLowerCase().includes(query) ||
          getTranslation(item.vocabulary).toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [flashcards, bookFilter, timeFilter, searchQuery]);

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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">All Flashcards</h1>
            <p className="text-muted-foreground mt-1">
              {filteredCards.length} of {flashcards.length} words
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

        {/* Filters row */}
        <div className="flex flex-wrap gap-2">
          <Select value={bookFilter} onValueChange={setBookFilter}>
            <SelectTrigger className="w-[180px]">
              <Library className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by book" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All books</SelectItem>
              {contentOptions.map((content) => (
                <SelectItem key={content.id} value={content.id}>
                  {content.title.length > 25
                    ? content.title.slice(0, 25) + "..."
                    : content.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          {(bookFilter !== "all" || timeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBookFilter("all");
                setTimeFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
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
