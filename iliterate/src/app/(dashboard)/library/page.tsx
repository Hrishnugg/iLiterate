import { createClient } from "@/lib/supabase/server";
import { LibraryContent } from "./LibraryContent";
import UploadBookDialog from "@/components/reader/UploadBookDialog";

export default async function LibraryPage() {
  const supabase = await createClient();

  const [{ data: contents }, { data: { user } }] = await Promise.all([
    supabase.from("content").select("*").is("user_id", null).order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  let targetLanguage: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("target_language")
      .eq("id", user.id)
      .single();
    targetLanguage = profile?.target_language ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Library</h1>
            <p className="text-muted-foreground mt-2">Browse content in your target language.</p>
          </div>
          <div>
            <UploadBookDialog onUploaded={() => {
              // simple reload to show newly uploaded content
              // navigate by reloading current route on the client is left to consumer
              // page is server-rendered so user can refresh to see uploads
            }} />
          </div>
        </div>
      </div>

      <LibraryContent contents={contents || []} targetLanguage={targetLanguage} />
    </div>
  );
}
