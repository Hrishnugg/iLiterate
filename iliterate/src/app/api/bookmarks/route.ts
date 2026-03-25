import { NextRequest, NextResponse } from "next/server";
import { UPLOADS_BUCKET } from "@/lib/uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// GET /api/bookmarks — returns all user bookmarks with joined metadata
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all bookmarks
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (bookmarksError) {
      return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
    }

    if (!bookmarks || bookmarks.length === 0) {
      return NextResponse.json([]);
    }

    // Separate by type
    const contentIds = bookmarks
      .filter((b) => b.item_type === "content")
      .map((b) => b.item_id);
    const lessonIds = bookmarks
      .filter((b) => b.item_type === "lesson")
      .map((b) => b.item_id);

    // Fetch content metadata
    const contentMap: Record<string, Record<string, unknown>> = {};
    if (contentIds.length > 0) {
      const { data: contents } = await supabase
        .from("content")
        .select(
          "id, title, difficulty_level, language, content_type, topic_tags, estimated_reading_time, source_upload_id"
        )
        .in("id", contentIds);

      if (contents) {
        const uploadIds = Array.from(
          new Set(
            contents
              .map((content) => content.source_upload_id)
              .filter(
                (value): value is string =>
                  typeof value === "string" && value.length > 0
              )
          )
        );

        const uploadsById = new Map<
          string,
          { kind: string | null; thumbnail_url: string | null }
        >();

        if (uploadIds.length > 0) {
          const { data: uploads } = await supabase
            .from("user_uploads")
            .select("id, kind, storage_path")
            .in("id", uploadIds)
            .eq("user_id", user.id);

          const admin = createAdminClient();
          await Promise.all(
            (uploads ?? []).map(async (upload) => {
              const isImage = upload.kind === "image";
              let thumbnailUrl: string | null = null;

              if (
                isImage &&
                typeof upload.storage_path === "string" &&
                upload.storage_path.length > 0
              ) {
                const { data: signedData } = await admin.storage
                  .from(UPLOADS_BUCKET)
                  .createSignedUrl(upload.storage_path, 60 * 60);
                thumbnailUrl = signedData?.signedUrl ?? null;
              }

              uploadsById.set(String(upload.id), {
                kind: typeof upload.kind === "string" ? upload.kind : null,
                thumbnail_url: thumbnailUrl,
              });
            })
          );
        }

        for (const c of contents) {
          const upload = c.source_upload_id
            ? uploadsById.get(String(c.source_upload_id))
            : null;

          contentMap[c.id] = {
            ...c,
            source_upload_kind: upload?.kind ?? null,
            thumbnail_url: upload?.thumbnail_url ?? null,
          };
        }
      }
    }

    // Fetch lesson metadata
    const lessonMap: Record<string, Record<string, unknown>> = {};
    if (lessonIds.length > 0) {
      const { data: lessons } = await supabase
        .from("lesson_sessions")
        .select("id, title, topic, target_level, word_count, quiz_score, quiz_max_score, status")
        .in("id", lessonIds);

      if (lessons) {
        for (const l of lessons) {
          lessonMap[l.id] = l;
        }
      }
    }

    // Merge and filter out orphaned bookmarks
    const result = bookmarks
      .map((bookmark) => {
        const metadata =
          bookmark.item_type === "content"
            ? contentMap[bookmark.item_id]
            : lessonMap[bookmark.item_id];

        if (!metadata) return null;

        return {
          ...bookmark,
          metadata,
        };
      })
      .filter(Boolean);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get bookmarks error:", error);
    return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
  }
}

// POST /api/bookmarks — toggle bookmark
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { itemType, itemId } = body;

    if (!itemType || !itemId) {
      return NextResponse.json({ error: "itemType and itemId are required" }, { status: 400 });
    }

    if (!["content", "lesson"].includes(itemType)) {
      return NextResponse.json({ error: "itemType must be 'content' or 'lesson'" }, { status: 400 });
    }

    // Check if bookmark exists
    const { data: existing } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("item_type", itemType)
      .eq("item_id", itemId)
      .single();

    if (existing) {
      // Delete existing bookmark
      const { error: deleteError } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", existing.id);

      if (deleteError) {
        return NextResponse.json({ error: "Failed to remove bookmark" }, { status: 500 });
      }

      return NextResponse.json({ bookmarked: false });
    } else {
      // Create new bookmark
      const { error: insertError } = await supabase
        .from("bookmarks")
        .insert({
          user_id: user.id,
          item_type: itemType,
          item_id: itemId,
        });

      if (insertError) {
        return NextResponse.json({ error: "Failed to create bookmark" }, { status: 500 });
      }

      return NextResponse.json({ bookmarked: true });
    }
  } catch (error) {
    console.error("Toggle bookmark error:", error);
    return NextResponse.json({ error: "Failed to toggle bookmark" }, { status: 500 });
  }
}
