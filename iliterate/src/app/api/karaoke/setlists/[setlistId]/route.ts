import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteKaraokeSetlist,
  loadKaraokeSetlist,
  updateKaraokeSetlist,
} from "@/lib/karaoke/item-server";
import {
  karaokeSetlistUpdateSchema,
  uuidSchema,
  validateRequestBody,
} from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ setlistId: string }> }
) {
  try {
    const { setlistId } = await params;
    const parsed = uuidSchema.safeParse(setlistId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid setlist ID format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const setlist = await loadKaraokeSetlist(supabase, user.id, setlistId);
    if (!setlist) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 });
    }

    return NextResponse.json({ setlist });
  } catch (error) {
    console.error("Karaoke setlist GET error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke setlist" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ setlistId: string }> }
) {
  try {
    const { setlistId } = await params;
    const parsed = uuidSchema.safeParse(setlistId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid setlist ID format" }, { status: 400 });
    }

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
      karaokeSetlistUpdateSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    const setlist = await updateKaraokeSetlist(supabase, user.id, setlistId, body);
    return NextResponse.json({ setlist });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update karaoke setlist";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ setlistId: string }> }
) {
  try {
    const { setlistId } = await params;
    const parsed = uuidSchema.safeParse(setlistId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid setlist ID format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteKaraokeSetlist(supabase, user.id, setlistId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete karaoke setlist";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
