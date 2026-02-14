import { createClient } from "@/lib/supabase/server";
import { Deck } from "@/components/flashcards/Deck";

interface PageProps {
  params: {
    contentId: string;
  };
}

export default async function ContentDeckPage({ params }: PageProps) {
  const { contentId } = await params;

  // fetch some metadata to show title
  const supabase = await createClient();
  const { data: content } = await supabase
    .from("content")
    .select("title")
    .eq("id", contentId)
    .single();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Flashcards for {content?.title || "book"}</h1>
      {/* Deck is a client component */}
      <Deck contentId={contentId} contentTitle={content?.title || ""} />
    </div>
  );
}
