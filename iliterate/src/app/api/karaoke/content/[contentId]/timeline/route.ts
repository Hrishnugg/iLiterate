import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapTimelineRow } from "@/lib/karaoke/server";
import {
  karaokeProviderSchema,
  karaokeTimelineRequestSchema,
  uuidSchema,
  validateRequestBody,
} from "@/lib/validations";

async function assertTimelineContentAccess(
  contentId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase
    .from("content")
    .select("id")
    .eq("id", contentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const contentIdResult = uuidSchema.safeParse(contentId);
    if (!contentIdResult.success) {
      return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await assertTimelineContentAccess(contentId, supabase);
    if (!hasAccess) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const provider = request.nextUrl.searchParams.get("provider");
    if (provider) {
      const providerResult = karaokeProviderSchema.safeParse(provider);
      if (!providerResult.success) {
        return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("karaoke_timelines")
        .select("*")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .eq("provider", providerResult.data)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "Failed to load karaoke timeline" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        timeline: data ? mapTimelineRow(data as never) : null,
      });
    }

    const { data, error } = await supabase
      .from("karaoke_timelines")
      .select("*")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load karaoke timelines" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      timelines: (data ?? []).map((timeline) => mapTimelineRow(timeline as never)),
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
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const contentIdResult = uuidSchema.safeParse(contentId);
    if (!contentIdResult.success) {
      return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await assertTimelineContentAccess(contentId, supabase);
    if (!hasAccess) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const { data: body, error: validationError } = await validateRequestBody(
      request,
      karaokeTimelineRequestSchema
    );

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError || "Invalid request" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("karaoke_timelines")
      .upsert(
        {
          user_id: user.id,
          content_id: contentId,
          provider: body.provider,
          cues: body.cues,
          metadata: body.metadata ?? {},
        },
        {
          onConflict: "user_id,content_id,provider",
        }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save karaoke timeline" },
        { status: 500 }
      );
    }

    return NextResponse.json({ timeline: mapTimelineRow(data as never) });
  } catch (error) {
    console.error("Karaoke timeline PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save karaoke timeline" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const contentIdResult = uuidSchema.safeParse(contentId);
    if (!contentIdResult.success) {
      return NextResponse.json({ error: "Invalid content ID format" }, { status: 400 });
    }

    const provider = request.nextUrl.searchParams.get("provider");
    const providerResult = karaokeProviderSchema.safeParse(provider);
    if (!providerResult.success) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
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
      .from("karaoke_timelines")
      .delete()
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .eq("provider", providerResult.data);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete karaoke timeline" },
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
