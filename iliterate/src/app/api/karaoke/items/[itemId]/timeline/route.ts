import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKaraokeItemBundle } from "@/lib/karaoke/item-server";
import { mapKaraokeItemTimelineRow } from "@/lib/karaoke/server";
import {
  getKaraokeTimingStatus,
  getLegacyKaraokeStatus,
} from "@/lib/karaoke/timing";
import {
  karaokeItemTimelineRequestSchema,
  uuidSchema,
  validateRequestBody,
} from "@/lib/validations";

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
      timeline: bundle.timeline ? mapKaraokeItemTimelineRow(bundle.timeline) : null,
      status: bundle.item.status,
      lyricsStatus: bundle.item.lyrics_status,
      timingStatus: bundle.item.timing_status,
    });
  } catch (error) {
    console.error("Karaoke timeline GET error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke timeline" },
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
      karaokeItemTimelineRequestSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    if (body.provider !== bundle.item.primary_provider) {
      return NextResponse.json(
        { error: "Timeline provider must match the karaoke item's primary provider" },
        { status: 400 }
      );
    }

    const { data: timelineData, error: timelineError } = await supabase
      .from("karaoke_item_timelines")
      .upsert(
        {
          user_id: user.id,
          karaoke_item_id: itemId,
          provider: body.provider,
          cues: body.cues,
          metadata: body.metadata ?? {},
        },
        {
          onConflict: "user_id,karaoke_item_id,provider",
        }
      )
      .select("*")
      .single();

    if (timelineError) {
      return NextResponse.json(
        { error: "Failed to save karaoke timeline" },
        { status: 500 }
      );
    }

    const nextTimingStatus = getKaraokeTimingStatus(body.provider, body.cues.length > 0);
    const nextLyricsStatus =
      bundle.item.lyrics_status ||
      (bundle.lyrics?.lines?.length ? "ready" : "manual_fallback");
    const nextStatus = getLegacyKaraokeStatus({
      provider: body.provider,
      lyricsStatus: nextLyricsStatus,
      timingStatus: nextTimingStatus,
    });
    const { error: itemError } = await supabase
      .from("karaoke_items")
      .update({
        status: nextStatus,
        timing_status: nextTimingStatus,
      })
      .eq("user_id", user.id)
      .eq("id", itemId);

    if (itemError) {
      return NextResponse.json(
        { error: "Failed to update karaoke item status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      timeline: mapKaraokeItemTimelineRow(timelineData as never),
      status: nextStatus,
      lyricsStatus: nextLyricsStatus,
      timingStatus: nextTimingStatus,
    });
  } catch (error) {
    console.error("Karaoke timeline PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save karaoke timeline" },
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

    const bundle = await loadKaraokeItemBundle(supabase, user.id, itemId);
    if (!bundle) {
      return NextResponse.json({ error: "Karaoke item not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("karaoke_item_timelines")
      .delete()
      .eq("user_id", user.id)
      .eq("karaoke_item_id", itemId)
      .eq("provider", bundle.item.primary_provider);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete karaoke timeline" },
        { status: 500 }
      );
    }

    const nextLyricsStatus =
      bundle.item.lyrics_status ||
      (bundle.lyrics?.lines?.length ? "ready" : "manual_fallback");
    const nextTimingStatus = getKaraokeTimingStatus(bundle.item.primary_provider, false);
    const nextStatus = getLegacyKaraokeStatus({
      provider: bundle.item.primary_provider,
      lyricsStatus: nextLyricsStatus,
      timingStatus: nextTimingStatus,
    });

    const { error: itemError } = await supabase
      .from("karaoke_items")
      .update({
        status: nextStatus,
        timing_status: nextTimingStatus,
      })
      .eq("user_id", user.id)
      .eq("id", itemId);

    if (itemError) {
      return NextResponse.json(
        { error: "Failed to update karaoke item status" },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Karaoke timeline DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete karaoke timeline" },
      { status: 500 }
    );
  }
}
