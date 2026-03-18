"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Bookmark, Loader2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Content } from "@/types/database";

interface BookmarkWithMetadata {
  id: string;
  item_type: "content" | "lesson";
  item_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface LibraryContentProps {
  contents: Content[];
}

export function LibraryContent({ contents }: LibraryContentProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkWithMetadata[]>([]);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
  const [hasLoadedBookmarks, setHasLoadedBookmarks] = useState(false);

  const loadBookmarks = useCallback(async () => {
    if (hasLoadedBookmarks) return;
    setIsLoadingBookmarks(true);
    try {
      const res = await fetch("/api/bookmarks");
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingBookmarks(false);
      setHasLoadedBookmarks(true);
    }
  }, [hasLoadedBookmarks]);

  return (
    <Tabs defaultValue="browse" onValueChange={(val) => {
      if (val === "saved") loadBookmarks();
    }}>
      <TabsList>
        <TabsTrigger value="browse">Browse</TabsTrigger>
        <TabsTrigger value="saved">Saved</TabsTrigger>
      </TabsList>

      <TabsContent value="browse">
        <BrowseTab contents={contents} />
      </TabsContent>

      <TabsContent value="saved">
        <SavedTab
          bookmarks={bookmarks}
          isLoading={isLoadingBookmarks}
          onRefresh={() => {
            setHasLoadedBookmarks(false);
            loadBookmarks();
          }}
        />
      </TabsContent>
    </Tabs>
  );
}

function BrowseTab({ contents }: { contents: Content[] }) {
  if (!contents || contents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No content yet</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Run the sample content SQL in your Supabase dashboard to add some
            reading material.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {contents.map((content) => (
        <Card key={content.id} className="flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{content.title}</CardTitle>
              <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {content.difficulty_level}
              </span>
            </div>
            <CardDescription className="flex items-center gap-2">
              <span className="capitalize">{content.language}</span>
              <span>•</span>
              <span>{content.content_type}</span>
              {content.estimated_reading_time && (
                <>
                  <span>•</span>
                  <span>{content.estimated_reading_time} min read</span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-end">
            {content.topic_tags && content.topic_tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1">
                {content.topic_tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <Button asChild className="w-full">
              <Link href={`/reader/${content.id}`}>
                <BookOpen className="mr-2 h-4 w-4" />
                Read
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SavedTab({
  bookmarks,
  isLoading,
}: {
  bookmarks: BookmarkWithMetadata[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bookmark className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No saved items yet</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Bookmark content while reading to save it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {bookmarks.map((bookmark) =>
        bookmark.item_type === "content" ? (
          <SavedContentCard key={bookmark.id} bookmark={bookmark} />
        ) : (
          <SavedLessonCard key={bookmark.id} bookmark={bookmark} />
        )
      )}
    </div>
  );
}

function SavedContentCard({ bookmark }: { bookmark: BookmarkWithMetadata }) {
  const m = bookmark.metadata;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{m.title as string}</CardTitle>
          <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {m.difficulty_level as string}
          </span>
        </div>
        <CardDescription className="flex items-center gap-2">
          <span className="capitalize">{m.language as string}</span>
          <span>•</span>
          <span>{m.content_type as string}</span>
          {Number(m.estimated_reading_time) > 0 && (
            <>
              <span>•</span>
              <span>{Number(m.estimated_reading_time)} min read</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        {Array.isArray(m.topic_tags) && m.topic_tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {(m.topic_tags as string[]).map((tag: string) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <Button asChild className="w-full">
          <Link href={`/reader/${bookmark.item_id}`}>
            <BookOpen className="mr-2 h-4 w-4" />
            Read
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SavedLessonCard({ bookmark }: { bookmark: BookmarkWithMetadata }) {
  const m = bookmark.metadata;
  const topic = m.topic as { name?: string; icon?: string } | null;
  const hasQuizScore = m.quiz_score != null && m.quiz_max_score != null;
  const quizPercentage = hasQuizScore
    ? Math.round(((m.quiz_score as number) / (m.quiz_max_score as number)) * 100)
    : null;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{m.title as string}</CardTitle>
          {Number(m.target_level) > 0 && (
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Level {Number(m.target_level)}
            </span>
          )}
        </div>
        <CardDescription className="flex items-center gap-2">
          {topic && (
            <>
              <span>{String(topic.icon)} {String(topic.name)}</span>
              <span>•</span>
            </>
          )}
          {Number(m.word_count) > 0 && <span>{Number(m.word_count)} words</span>}
          {String(m.status) === "completed" && hasQuizScore && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Award className="h-3 w-3" />
                {quizPercentage}%
              </span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <Button asChild className="w-full">
          <Link href={`/lesson-plan/${bookmark.item_id}`}>
            <BookOpen className="mr-2 h-4 w-4" />
            {String(m.status) === "completed" ? "Re-Read" : "Continue"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
