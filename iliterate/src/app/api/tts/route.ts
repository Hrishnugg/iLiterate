import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ElevenLabsTtsError,
  generateReaderSpeech,
  getConfiguredModelId,
  getModelCharacterLimit,
} from "@/lib/tts/elevenlabs";
import { ttsRequestSchema, validateRequestBody } from "@/lib/validations";

function extractReadableText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  const minBoundary = Math.floor(maxChars * 0.6);

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const whitespaceBoundary = text.lastIndexOf(" ", end);
      if (whitespaceBoundary > start + minBoundary) {
        end = whitespaceBoundary;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end <= start) {
      end = Math.min(start + maxChars, text.length);
    }
    start = end;
  }

  return chunks;
}

function concatAudioSegments(segments: Uint8Array[]): Uint8Array {
  const totalLength = segments.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const segment of segments) {
    merged.set(segment, offset);
    offset += segment.length;
  }

  return merged;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication first because TTS should only be available to signed-in users.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: requestBody, error: validationError } = await validateRequestBody(
      request,
      ttsRequestSchema
    );

    if (validationError || !requestBody) {
      return NextResponse.json(
        { error: validationError || "Invalid request body" },
        { status: 400 }
      );
    }

    let textBody: string;
    let language: string;

    if (requestBody.lessonId) {
      // Fetch from lesson_sessions table
      const { data: lesson, error: lessonError } = await supabase
        .from("lesson_sessions")
        .select("id, content_body")
        .eq("id", requestBody.lessonId)
        .single();

      if (lessonError || !lesson) {
        return NextResponse.json({ error: "Content not found" }, { status: 404 });
      }

      textBody = lesson.content_body || "";

      // Language lives on the user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("target_language")
        .eq("id", user.id)
        .single();

      language = profile?.target_language || "en";
    } else {
      // Fetch from content table
      const { data: content, error: contentError } = await supabase
        .from("content")
        .select("id, body, language")
        .eq("id", requestBody.contentId)
        .single();

      if (contentError || !content) {
        return NextResponse.json({ error: "Content not found" }, { status: 404 });
      }

      textBody = content.body || "";
      language = content.language || "en";
    }

    const readableText = extractReadableText(textBody);
    if (!readableText) {
      return NextResponse.json(
        { error: "Content does not contain readable text for audio playback" },
        { status: 400 }
      );
    }

    const modelId = getConfiguredModelId();
    const maxCharsPerRequest = getModelCharacterLimit(modelId);
    const chunks = splitTextIntoChunks(readableText, maxCharsPerRequest);

    const audioSegments: Uint8Array[] = [];
    let contentType = "audio/mpeg";

    for (const chunk of chunks) {
      const speech = await generateReaderSpeech({
        text: chunk,
        language: language,
      });

      audioSegments.push(speech.audioBytes);
      contentType = speech.contentType;
    }

    if (audioSegments.length === 0) {
      return NextResponse.json(
        { error: "Audio generation produced no output" },
        { status: 502 }
      );
    }

    const mergedAudio = concatAudioSegments(audioSegments);

    // Convert the Uint8Array to a BodyInit that works in both Edge/browser and Node runtimes.
    // In browser/Edge use a Blob; in Node use a Buffer. Include Content-Length from the byte length.
    let body: BodyInit;
    if (typeof Blob !== "undefined") {
      // Normalize to an ArrayBuffer-backed TypedArray so BlobPart typing is satisfied
      const safeArray = new Uint8Array(mergedAudio);
      body = new Blob([safeArray], { type: contentType });
    } else {
      // Node runtime fallback
      // Buffer is acceptable as BodyInit in Node environments
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Buffer exists at runtime
      body = Buffer.from(mergedAudio);
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="reader-tts.mp3"',
        "Content-Length": String(mergedAudio.byteLength),
        "X-TTS-Chunk-Count": String(chunks.length),
        "X-TTS-Model-Id": modelId,
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
