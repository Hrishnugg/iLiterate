import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function ReaderPage() {
  const supabase = await createClient();

  // Get first available content for demo
  const { data: contents } = await supabase
    .from("content")
    .select("id, title")
    .limit(5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reader</h1>
        <p className="text-muted-foreground mt-2">
          Select content from your library to start reading.
        </p>
      </div>

      {contents && contents.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Available Content
          </h2>
          <div className="grid gap-3">
            {contents.map((content) => (
              <Link key={content.id} href={`/reader/${content.id}`}>
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className="text-left">
                    <p className="font-medium">{content.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Click to read
                    </p>
                  </div>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No content available yet. Check your library or upload content.
          </p>
          <Link href="/library">
            <Button className="mt-4">Go to Library</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
