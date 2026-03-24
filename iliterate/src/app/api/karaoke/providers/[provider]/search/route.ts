import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchProviderTracks } from "@/lib/karaoke/provider-server";
import { karaokeMusicProviderSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const parsed = karaokeMusicProviderSchema.safeParse(provider);
    if (!parsed.success) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!query) {
      return NextResponse.json({ tracks: [] });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tracks = await searchProviderTracks(supabase, user.id, parsed.data, query);
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Karaoke provider search error:", error);
    return NextResponse.json(
      { error: "Failed to search karaoke provider" },
      { status: 500 }
    );
  }
}
