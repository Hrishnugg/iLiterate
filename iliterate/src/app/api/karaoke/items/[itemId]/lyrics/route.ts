import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKaraokeItemBundle } from "@/lib/karaoke/item-server";
import { getKaraokeItemReadyStatus, splitLyricsTextToLines } from "@/lib/karaoke/timing";
import { uuidSchema, karaokeLyricsUpdateSchema, validateRequestBody } from "@/lib/validations";
import { mapKaraokeLyricsRow } from "@/lib/karaoke/server";

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

    const bundle = await loadKaraokeItemBundle(supabase, user.id, itemId);
    if (!bundle) {
      return NextResponse.json({ error: "Karaoke item not found" }, { status: 404 });
    }

    return NextResponse.json({
      lyrics: bundle.lyrics ? mapKaraokeLyricsRow(bundle.lyrics) : null,
      job: bundle.job,
      status: bundle.item.status,
    });
  } catch (error) {
    console.error("Karaoke lyrics GET error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke lyrics" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
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

    const bundle = await loadKaraokeItemBundle(supabase, user.id, itemId);
    if (!bundle) {
      return NextResponse.json({ error: "Karaoke item not found" }, { status: 404 });
    }

    const { data: body, error: validationError } = await validateRequestBody(
      request,
      karaokeLyricsUpdateSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    const lines = splitLyricsTextToLines(body.text);
    const nextStatus =
      lines.length === 0
        ? "needs_lyrics"
        : getKaraokeItemReadyStatus(
            bundle.item.primary_provider,
            Boolean(bundle.timeline?.cues?.length)
          );

    const { data: lyricsData, error: lyricsError } = await supabase
      .from("karaoke_lyrics")
      .upsert(
        {
          user_id: user.id,
          karaoke_item_id: itemId,
          source: body.source ?? "manual",
          text: body.text,
          lines,
          metadata: {
            ...(bundle.lyrics?.metadata ?? {}),
            updatedBy: "manual",
          },
        },
        {
          onConflict: "karaoke_item_id",
        }
      )
      .select("*")
      .single();

    if (lyricsError) {
      return NextResponse.json(
        { error: "Failed to save karaoke lyrics" },
        { status: 500 }
      );
    }

    const [{ error: itemError }, { error: jobError }] = await Promise.all([
      supabase
        .from("karaoke_items")
        .update({
          status: nextStatus,
        })
        .eq("user_id", user.id)
        .eq("id", itemId),
      supabase
        .from("karaoke_lyrics_jobs")
        .upsert(
          {
            user_id: user.id,
            karaoke_item_id: itemId,
            provider: bundle.item.primary_provider,
            status: "completed",
            last_error: null,
            processed_at: new Date().toISOString(),
            metadata: {
              ...(bundle.job?.metadata ?? {}),
              outcome: "manual_override",
            },
          },
          {
            onConflict: "karaoke_item_id",
          }
        ),
    ]);

    if (itemError || jobError) {
      return NextResponse.json(
        { error: "Failed to update karaoke item state" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lyrics: mapKaraokeLyricsRow(lyricsData as never),
      status: nextStatus,
    });
  } catch (error) {
    console.error("Karaoke lyrics PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save karaoke lyrics" },
      { status: 500 }
    );
  }
}
