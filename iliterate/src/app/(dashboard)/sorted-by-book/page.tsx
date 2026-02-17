import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface Content {
  id: string;
  title: string;
  language: string;
  content_type: string;
  topic_tags: string[] | null;
}

export default async function SortedByBookPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Sorted by Book</h1>
        <p className="text-muted-foreground mt-2">Please sign in to view your flashcards.</p>
      </div>
    );
  }

  // Fetch list of contents where user has saved vocabulary (flashcards)
  const { data: vocabRows } = await supabase
    .from("user_vocabulary")
    .select("content_id")
    .eq("user_id", user.id);

  const contentIds = [...new Set(
    (vocabRows || [])
      .map((row) => row.content_id)
      .filter(Boolean)
  )];

  let contents: Content[] = [];
  if (contentIds.length > 0) {
    const { data } = await supabase
      .from("content")
      .select("id, title, language, content_type, topic_tags")
      .in("id", contentIds)
      .order("created_at", { ascending: false });
    contents = data || [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sorted by Book</h1>
        <p className="text-muted-foreground mt-2">
          Browse flashcards organized by the book or article they came from.
        </p>
      </div>

      {contents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contents.map((content) => (
            <Card key={content.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{content.title}</CardTitle>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span className="capitalize">{content.language}</span>
                  <span>•</span>
                  <span>{content.content_type}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-end">
                {content.topic_tags && content.topic_tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {content.topic_tags.map((tag) => (
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
                  <Link href={`/flashcards/${content.id}`}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Study Deck
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No decks yet</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Save words while reading to create flashcard decks organized by book.
            </p>
            <Button asChild className="mt-4">
              <Link href="/library">Browse Library</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
