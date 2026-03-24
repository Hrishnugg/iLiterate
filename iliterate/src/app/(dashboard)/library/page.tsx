import { createClient } from "@/lib/supabase/server";
import { LibraryContent } from "./LibraryContent";

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

  return <LibraryContent contents={contents || []} targetLanguage={targetLanguage} />;
}
