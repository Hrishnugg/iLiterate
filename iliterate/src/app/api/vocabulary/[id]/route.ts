import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validations";

// DELETE /api/vocabulary/:id - Delete a flashcard
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
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("user_vocabulary")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to delete flashcard:", error);
      return NextResponse.json({ error: "Failed to delete flashcard" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete flashcard error:", error);
    return NextResponse.json(
      { error: "Failed to delete flashcard" },
      { status: 500 }
    );
  }
}
