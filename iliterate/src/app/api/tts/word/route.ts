import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ElevenLabsTtsError,
  generateReaderSpeech,
} from "@/lib/tts/elevenlabs";
import { ttsWordRequestSchema, validateRequestBody } from "@/lib/validations";

/**
 * POST /api/tts/word — generate TTS for a single word or short phrase.
 * Returns audio/mpeg with a 1-hour private cache header so the browser
 * can serve repeat plays without another round-trip.
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

    const { data: body, error: validationError } = await validateRequestBody(
      request,
      ttsWordRequestSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request body" },
        { status: 400 }
      );
    }

    const speech = await generateReaderSpeech({
      text: body.text,
      language: body.language,
    });

    const safeArray = new Uint8Array(speech.audioBytes);
    const blob = new Blob([safeArray], { type: speech.contentType });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": speech.contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(safeArray.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsTtsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
