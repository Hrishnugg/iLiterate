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

export default async function LibraryPage() {
  const supabase = await createClient();

  const { data: contents } = await supabase
    .from("content")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Library</h1>
        <p className="text-muted-foreground mt-2">
          Browse content in your target language.
        </p>
      </div>

      {contents && contents.length > 0 ? (
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
      ) : (
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
      )}
    </div>
  );
}
