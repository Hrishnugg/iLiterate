import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    conversationId: string;
  }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { conversationId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error: conversationError } = await supabase
      .from("direct_conversations")
      .select("id")
      .eq("id", conversationId)
      .single();

    if (conversationError) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const timestamp = new Date().toISOString();
    const { error: readError } = await supabase
      .from("conversation_reads")
      .upsert({
        conversation_id: conversationId,
        user_id: user.id,
        last_read_at: timestamp,
        updated_at: timestamp,
      })
      .select("conversation_id")
      .single();

    if (readError) {
      throw readError;
    }

    return NextResponse.json({ ok: true, last_read_at: timestamp });
  } catch (error) {
    console.error("Mark social conversation read error:", error);
    return NextResponse.json(
      { error: "Failed to update conversation read state" },
      { status: 500 }
    );
  }
}
