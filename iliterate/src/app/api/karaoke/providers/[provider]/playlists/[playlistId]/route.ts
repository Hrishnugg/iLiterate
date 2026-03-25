import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProviderPlaylistTracks } from "@/lib/karaoke/provider-server";
import { karaokeMusicProviderSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ provider: string; playlistId: string }> }
) {
  try {
    const { provider, playlistId } = await params;
    const parsedProvider = karaokeMusicProviderSchema.safeParse(provider);
    if (!parsedProvider.success) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cursor = request.nextUrl.searchParams.get("cursor");
    const payload = await loadProviderPlaylistTracks(
      supabase,
      user.id,
      parsedProvider.data,
      playlistId,
      cursor
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Karaoke provider playlist tracks error:", error);
    return NextResponse.json(
      { error: "Failed to load provider playlist" },
      { status: 500 }
    );
  }
}
