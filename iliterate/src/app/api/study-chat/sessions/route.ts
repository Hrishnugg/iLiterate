import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createStudyChatSession,
  getViewerLanguages,
  listStudyChatSessions,
} from "@/lib/study-chat/server";
import { createClient } from "@/lib/supabase/server";

const createSessionSchema = z.object({
  title: z.string().trim().max(80).optional(),
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

export async function GET() {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [sessions, viewerLanguages] = await Promise.all([
      listStudyChatSessions(supabase, user.id),
      getViewerLanguages(supabase, user.id),
    ]);

    return NextResponse.json({
      sessions,
      viewerLanguages,
    });
  } catch (error) {
    console.error("Study chat sessions GET error:", error);
    return NextResponse.json(
      { error: "Failed to load study chat sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createSessionSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid study chat session request" },
        { status: 400 }
      );
    }

    const thread = await createStudyChatSession(supabase, user.id, parsed.data);
    const sessions = await listStudyChatSessions(supabase, user.id);

    return NextResponse.json(
      {
        session: thread.session,
        messages: thread.messages,
        uploads: thread.uploads,
        sessions,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Study chat sessions POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create study chat session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
