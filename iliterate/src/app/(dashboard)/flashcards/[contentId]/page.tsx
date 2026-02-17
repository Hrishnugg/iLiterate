import { createClient } from "@/lib/supabase/server";
import { Deck } from "@/components/flashcards/Deck";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{
    contentId: string;
  }>;
}

export default async function ContentDeckPage({ params }: PageProps) {
  const { contentId } = await params;

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("content")
    .select("title")
    .eq("id", contentId)
    .single();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sorted-by-book">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          Flashcards: {content?.title || "Book"}
        </h1>
      </div>

      <Deck contentId={contentId} contentTitle={content?.title || ""} />
    </div>
  );
}
