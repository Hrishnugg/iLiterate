import { createClient } from "@/lib/supabase/server";
import { LibraryContent } from "./LibraryContent";

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

      <LibraryContent contents={contents || []} />
    </div>
  );
}
