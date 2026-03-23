import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!q || q.length < 1) {
      return NextResponse.json({ content: [], lessons: [], vocabulary: [], friends: [] });
    }

    const like = `%${q}%`;

    const [contentRes, lessonsRes, vocabWordRes, friendsRes] = await Promise.allSettled([
      // Library content: search by title
      supabase
        .from("content")
        .select("id, title, content_type, difficulty_level, language")
        .ilike("title", like)
        .limit(5),

      // Lesson plans: search by title
      supabase
        .from("lesson_sessions")
        .select("id, title, topic, status, created_at")
        .eq("user_id", user.id)
        .ilike("title", like)
        .order("created_at", { ascending: false })
        .limit(5),

      // Vocabulary: find matching words in the vocabulary table first
      supabase
        .from("vocabulary")
        .select("id, word, pronunciation")
        .ilike("word", like)
        .limit(10),

      // Friends: search public_profiles by username or display_name
      supabase
        .from("public_profiles")
        .select("id, username, display_name, avatar_seed")
        .neq("id", user.id)
        .not("username", "is", null)
        .or(`username.ilike.${like},display_name.ilike.${like}`)
        .limit(5),
    ]);

    const content =
      contentRes.status === "fulfilled" && !contentRes.value.error
        ? (contentRes.value.data ?? []).map((c) => ({
            id: c.id,
            title: c.title,
            subtitle: [c.content_type, c.difficulty_level].filter(Boolean).join(" · "),
            language: c.language,
          }))
        : [];

    const lessons =
      lessonsRes.status === "fulfilled" && !lessonsRes.value.error
        ? (lessonsRes.value.data ?? []).map((l) => ({
            id: l.id,
            title: l.title ?? "Untitled Lesson",
            subtitle: [l.topic, l.status].filter(Boolean).join(" · "),
            status: l.status,
          }))
        : [];

    // Cross-reference vocabulary matches against user's saved words
    let vocabulary: { id: string; word: string; reading: string | null }[] = [];
    if (vocabWordRes.status === "fulfilled" && !vocabWordRes.value.error) {
      const matchedWords = vocabWordRes.value.data ?? [];
      if (matchedWords.length > 0) {
        const matchedIds = matchedWords.map((v) => v.id);
        const { data: userVocab, error: uvError } = await supabase
          .from("user_vocabulary")
          .select("vocabulary_id")
          .eq("user_id", user.id)
          .in("vocabulary_id", matchedIds);
        if (!uvError && userVocab) {
          const savedIds = new Set(userVocab.map((uv) => uv.vocabulary_id));
          vocabulary = matchedWords
            .filter((v) => savedIds.has(v.id))
            .slice(0, 5)
            .map((v) => ({ id: v.id, word: v.word, reading: v.pronunciation }));
        }
      }
    }

    const friends =
      friendsRes.status === "fulfilled" && !friendsRes.value.error
        ? (friendsRes.value.data ?? []).map((p) => ({
            id: p.id,
            display_name: p.display_name,
            username: p.username,
          }))
        : [];

    return NextResponse.json({ content, lessons, vocabulary, friends });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
