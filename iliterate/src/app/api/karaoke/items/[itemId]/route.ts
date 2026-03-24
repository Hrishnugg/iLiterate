import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKaraokeItemDetail } from "@/lib/karaoke/item-server";
import { uuidSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const parsed = uuidSchema.safeParse(itemId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid item ID format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await loadKaraokeItemDetail(supabase, user.id, itemId);
    if (!item) {
      return NextResponse.json({ error: "Karaoke item not found" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Karaoke item GET error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const parsed = uuidSchema.safeParse(itemId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid item ID format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("karaoke_items")
      .delete()
      .eq("user_id", user.id)
      .eq("id", itemId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete karaoke item" },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Karaoke item DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete karaoke item" },
      { status: 500 }
    );
  }
}
