import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteStudyChatSession,
  listStudyChatSessions,
  renameStudyChatSession,
} from "@/lib/study-chat/server";
import { createClient } from "@/lib/supabase/server";

const renameSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null as null };
  }

  return { supabase, user };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const body = await request.json().catch(() => null);
    const parsed = renameSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid title" },
        { status: 400 }
      );
    }

    const session = await renameStudyChatSession(supabase, user.id, sessionId, parsed.data.title);
    const sessions = await listStudyChatSessions(supabase, user.id);

    return NextResponse.json({ session, sessions });
  } catch (error) {
    console.error("Study chat session PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rename session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    await deleteStudyChatSession(supabase, user.id, sessionId);
    const sessions = await listStudyChatSessions(supabase, user.id);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Study chat session DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete session" },
      { status: 500 }
    );
  }
}
