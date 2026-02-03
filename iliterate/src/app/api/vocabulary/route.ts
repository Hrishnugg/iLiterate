import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { vocabularyRequestSchema, uuidSchema, validateRequestBody } from "@/lib/validations";

// POST /api/vocabulary - Create or get vocabulary word and add to user's flashcards
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

    // Validate request body
    const { data: body, error: validationError } = await validateRequestBody(
      request,
      vocabularyRequestSchema
    );

    if (validationError || !body) {
      return NextResponse.json({ error: validationError || "Invalid request body" }, { status: 400 });
    }

    const {
      word,
      language,
      translation,
      transliteration,
      partOfSpeech,
      definitions,
      contentId,
      contextSentence,
    } = body;

    // 1. Check if vocabulary entry exists, create if not
    let { data: vocabEntry } = await supabase
      .from("vocabulary")
      .select("*")
      .eq("word", word.toLowerCase())
      .eq("language", language)
      .single();

    if (!vocabEntry) {
      // Create new vocabulary entry
      const { data: newVocab, error: createError } = await supabase
        .from("vocabulary")
        .insert({
          word: word.toLowerCase(),
          language,
          pronunciation: transliteration,
          definitions: definitions
            ? { definitions }
            : { translation },
          part_of_speech: partOfSpeech,
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: "Failed to create vocabulary entry" },
          { status: 500 }
        );
      }
      vocabEntry = newVocab;
    }

    // 2. Check if user already has this word
    const { data: existingUserVocab } = await supabase
      .from("user_vocabulary")
      .select("*")
      .eq("user_id", user.id)
      .eq("vocabulary_id", vocabEntry.id)
      .single();

    if (existingUserVocab) {
      return NextResponse.json({
        message: "Word already in your vocabulary",
        userVocabulary: existingUserVocab,
        vocabulary: vocabEntry,
      });
    }

    // 3. Add to user's vocabulary (flashcard with SM-2 defaults)
    const { data: userVocab, error: userVocabError } = await supabase
      .from("user_vocabulary")
      .insert({
        user_id: user.id,
        vocabulary_id: vocabEntry.id,
        content_id: contentId,
        context_sentence: contextSentence,
        ease_factor: 2.5,
        interval_days: 1,
        repetitions: 0,
        next_review_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (userVocabError) {
      return NextResponse.json(
        { error: "Failed to add word to vocabulary" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Word added to vocabulary",
        userVocabulary: userVocab,
        vocabulary: vocabEntry,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create vocabulary error:", error);
    return NextResponse.json(
      { error: "Failed to add word to vocabulary" },
      { status: 500 }
    );
  }
}

// GET /api/vocabulary - Get user's vocabulary
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

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId");
    const dueOnly = searchParams.get("dueOnly") === "true";

    // Validate contentId if provided
    if (contentId) {
      const result = uuidSchema.safeParse(contentId);
      if (!result.success) {
        return NextResponse.json({ error: "Invalid contentId format" }, { status: 400 });
      }
    }

    let query = supabase
      .from("user_vocabulary")
      .select(`
        *,
        vocabulary:vocabulary_id (*)
      `)
      .eq("user_id", user.id);

    if (contentId) {
      query = query.eq("content_id", contentId);
    }

    if (dueOnly) {
      query = query.lte("next_review_date", new Date().toISOString().split("T")[0]);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch vocabulary" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get vocabulary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vocabulary" },
      { status: 500 }
    );
  }
}
