import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuiz } from "@/lib/quiz-generator";
import { z } from "zod";

const generateQuizSchema = z.object({
  contentId: z.string().uuid(),
});

/**
 * POST /api/quiz/generate - Generate a quiz for content
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = generateQuizSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid contentId" },
        { status: 400 }
      );
    }

    const { contentId } = validationResult.data;

    // Fetch content
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("*")
      .eq("id", contentId)
      .single();

    if (contentError || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // Get user's profile for native language
    const { data: profile } = await supabase
      .from("profiles")
      .select("native_language")
      .eq("id", user.id)
      .single();

    // Get user's skill levels
    const { data: skillLevels } = await supabase
      .from("user_skill_levels")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Get user's saved vocabulary from this content for vocab questions
    const { data: userVocabulary } = await supabase
      .from("user_vocabulary")
      .select(
        `
        *,
        vocabulary:vocabulary_id (word)
      `
      )
      .eq("user_id", user.id)
      .eq("content_id", contentId);

    // Calculate user's overall level (or default to 5)
    const userLevel = skillLevels
      ? Math.floor(
          skillLevels.reading_level * skillLevels.reading_weight +
            skillLevels.vocabulary_level * skillLevels.vocabulary_weight +
            skillLevels.grammar_level * skillLevels.grammar_weight
        )
      : 5;

    // Generate quiz
    const quiz = await generateQuiz({
      content,
      userLevel,
      nativeLanguage: profile?.native_language || "english",
      savedVocabulary: userVocabulary?.map((uv) => ({
        word: uv.vocabulary?.word || "",
        context: uv.context_sentence || undefined,
      })),
      questionCount: 5,
    });

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Quiz generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
