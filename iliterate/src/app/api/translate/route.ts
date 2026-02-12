import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translateWithContext } from "@/lib/google-ai";
import { translateRequestSchema, validateRequestBody } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
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
      translateRequestSchema
    );

    if (validationError || !body) {
      return NextResponse.json({ error: validationError || "Invalid request body" }, { status: 400 });
    }

    const { text, sourceLang, targetLang, contextBefore, contextAfter, contentId, lessonId } = body;

    // Get translation from Gemini
    const translation = await translateWithContext({
      text,
      sourceLang,
      targetLang,
      contextBefore,
      contextAfter,
    });

    // If contentId or lessonId provided, save to translation_lookups
    if (contentId || lessonId) {
      const { error: insertError } = await supabase
        .from("translation_lookups")
        .insert({
          user_id: user.id,
          content_id: contentId || null,
          lesson_id: lessonId || null,
          source_text: text,
          translated_text: translation.translation,
          source_lang: sourceLang,
          target_lang: targetLang,
          transliteration: translation.transliteration,
        });

      if (insertError) {
        console.error("Failed to save translation lookup:", insertError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json(translation);
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Failed to translate text" },
      { status: 500 }
    );
  }
}
