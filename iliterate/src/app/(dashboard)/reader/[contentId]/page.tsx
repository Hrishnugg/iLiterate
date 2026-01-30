import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArticleRenderer } from "@/components/reader/ArticleRenderer";

interface ReaderPageProps {
  params: Promise<{
    contentId: string;
  }>;
}

export default async function ReaderContentPage({ params }: ReaderPageProps) {
  const { contentId } = await params;
  const supabase = await createClient();

  // Fetch content
  const { data: content, error } = await supabase
    .from("content")
    .select("*")
    .eq("id", contentId)
    .single();

  if (error || !content) {
    notFound();
  }

  return <ArticleRenderer content={content} />;
}
