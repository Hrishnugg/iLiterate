import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validations";

// PATCH /api/highlights/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Validate UUID format
    const uuidResult = uuidSchema.safeParse(id);
    if (!uuidResult.success) {
      return NextResponse.json({ error: "Invalid highlight ID format" }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { note, translation, transliteration, partOfSpeech } = body;

    // Build update object with only provided fields
    const updates: Record<string, string | null> = {};
    if (note !== undefined) updates.note = note;
    if (translation !== undefined) updates.translation = translation;
    if (transliteration !== undefined) updates.transliteration = transliteration;
    if (partOfSpeech !== undefined) updates.part_of_speech = partOfSpeech;

    const { data, error } = await supabase
      .from("highlights")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Highlight not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to update highlight" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Highlight not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update highlight error:", error);
    return NextResponse.json(
      { error: "Failed to update highlight" },
      { status: 500 }
    );
  }
}

// DELETE /api/highlights/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Validate UUID format
    const uuidResult = uuidSchema.safeParse(id);
    if (!uuidResult.success) {
      return NextResponse.json({ error: "Invalid highlight ID format" }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First, get the highlight to find the associated word
    const { data: highlight } = await supabase
      .from("highlights")
      .select("selected_text, content_id, lesson_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    // Delete the highlight
    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete highlight" }, { status: 500 });
    }

    // Also delete associated flashcard if it exists
    if (highlight?.selected_text) {
      // Find the vocabulary entry for this word
      const { data: vocabEntry } = await supabase
        .from("vocabulary")
        .select("id")
        .eq("word", highlight.selected_text.toLowerCase())
        .single();

      if (vocabEntry) {
        // Delete the user's flashcard for this word (matching content/lesson context)
        let deleteQuery = supabase
          .from("user_vocabulary")
          .delete()
          .eq("user_id", user.id)
          .eq("vocabulary_id", vocabEntry.id);

        // Match by content_id or lesson_id if available
        if (highlight.content_id) {
          deleteQuery = deleteQuery.eq("content_id", highlight.content_id);
        } else if (highlight.lesson_id) {
          deleteQuery = deleteQuery.eq("lesson_id", highlight.lesson_id);
        }

        await deleteQuery;
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete highlight error:", error);
    return NextResponse.json(
      { error: "Failed to delete highlight" },
      { status: 500 }
    );
  }
}
