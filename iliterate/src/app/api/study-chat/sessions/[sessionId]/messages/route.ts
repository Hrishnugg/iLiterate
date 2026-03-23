import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createStudyChatReply,
  getStudyChatThread,
  getViewerLanguages,
  listStudyChatSessions,
} from "@/lib/study-chat/server";
import type { StudyChatAction } from "@/lib/study-chat/types";
import { createClient } from "@/lib/supabase/server";

const createMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  action: z.enum(["chat", "summary", "translation", "vocabulary"]).optional(),
  uploadIds: z.array(z.string().uuid()).max(8).optional(),
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;
    const [thread, viewerLanguages] = await Promise.all([
      getStudyChatThread(supabase, user.id, sessionId),
      getViewerLanguages(supabase, user.id),
    ]);

    if (!thread) {
      return NextResponse.json({ error: "Study chat session not found" }, { status: 404 });
    }

    return NextResponse.json({
      session: thread.session,
      messages: thread.messages,
      uploads: thread.uploads,
      viewerLanguages,
    });
  } catch (error) {
    console.error("Study chat messages GET error:", error);
    return NextResponse.json(
      { error: "Failed to load study chat thread" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid study chat message" },
        { status: 400 }
      );
    }

    const { sessionId } = await params;
    const thread = await createStudyChatReply({
      supabase,
      userId: user.id,
      sessionId,
      body: parsed.data.body,
      action: (parsed.data.action ?? "chat") as StudyChatAction,
      uploadIds: parsed.data.uploadIds,
    });

    const sessions = await listStudyChatSessions(supabase, user.id);

    return NextResponse.json({
      session: thread.session,
      messages: thread.messages,
      uploads: thread.uploads,
      sessions,
    });
  } catch (error) {
    console.error("Study chat messages POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send study chat message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
