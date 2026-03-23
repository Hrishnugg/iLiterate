import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { extractUrlPreview } from "@/lib/content-imports";
import { createClient } from "@/lib/supabase/server";

const urlSchema = z.object({
  url: z.string().url(),
});

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

    const body = await request.json();
    const parsed = urlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid URL" },
        { status: 400 }
      );
    }

    const preview = await extractUrlPreview(parsed.data.url);

    return NextResponse.json({
      sourceUrl: preview.sourceUrl,
      title: preview.title,
      extractedText: preview.extractedText,
      language: preview.language,
      difficulty: preview.difficulty,
      suggestedContentType: preview.suggestedContentType,
      contentTypeOptions: preview.contentTypeOptions,
    });
  } catch (error) {
    console.error("Import URL error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import URL",
      },
      { status: 500 }
    );
  }
}
