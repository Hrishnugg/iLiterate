import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validations";

// GET /api/content/batch?ids=id1,id2,id3
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
    }

    const ids = idsParam.split(",").filter(Boolean);

    // Validate all UUIDs
    for (const id of ids) {
      const result = uuidSchema.safeParse(id);
      if (!result.success) {
        return NextResponse.json({ error: `Invalid UUID format: ${id}` }, { status: 400 });
      }
    }

    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("content")
      .select("id, title")
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Batch content error:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
