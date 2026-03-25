import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { karaokeProviderSchema } from "@/lib/validations";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const parsed = karaokeProviderSchema.safeParse(provider);
    if (!parsed.success || parsed.data === "tts") {
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

    const { error } = await supabase
      .from("user_music_connections")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", parsed.data);

    if (error) {
      return NextResponse.json(
        { error: "Failed to disconnect provider" },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Karaoke provider DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect provider" },
      { status: 500 }
    );
  }
}
