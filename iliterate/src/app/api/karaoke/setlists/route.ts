import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createKaraokeSetlist,
  loadKaraokeSetlists,
} from "@/lib/karaoke/item-server";
import {
  karaokeSetlistCreateSchema,
  validateRequestBody,
} from "@/lib/validations";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const setlists = await loadKaraokeSetlists(supabase, user.id);
    return NextResponse.json({ setlists });
  } catch (error) {
    console.error("Karaoke setlists GET error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke setlists" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
      karaokeSetlistCreateSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    const setlist = await createKaraokeSetlist(supabase, user.id, body.name);
    return NextResponse.json({ setlist }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create karaoke setlist";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
