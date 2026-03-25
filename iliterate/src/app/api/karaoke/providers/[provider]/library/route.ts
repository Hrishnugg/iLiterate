import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProviderLibrary } from "@/lib/karaoke/provider-server";
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

    const collections = await loadProviderLibrary(supabase, user.id, parsed.data);
    return NextResponse.json({ collections });
  } catch (error) {
    console.error("Karaoke provider library error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke provider library" },
      { status: 500 }
    );
  }
}
