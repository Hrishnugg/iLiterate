import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { browseProviderTracks } from "@/lib/karaoke/provider-server";
import { karaokeMusicProviderSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const parsed = karaokeMusicProviderSchema.safeParse(provider);
    if (!parsed.success) {
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

    const tracks = await browseProviderTracks(supabase, user.id, parsed.data);
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Karaoke provider browse error:", error);
    return NextResponse.json(
      { error: "Failed to browse karaoke provider" },
      { status: 500 }
    );
  }
}
