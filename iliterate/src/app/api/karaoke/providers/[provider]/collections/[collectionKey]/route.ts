import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProviderCollection } from "@/lib/karaoke/provider-server";
import {
  karaokeMusicProviderSchema,
  providerCollectionKindSchema,
} from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string; collectionKey: string }> }
) {
  try {
    const { provider, collectionKey } = await params;
    const parsedProvider = karaokeMusicProviderSchema.safeParse(provider);
    const parsedCollection = providerCollectionKindSchema.safeParse(collectionKey);
    if (!parsedProvider.success || !parsedCollection.success) {
      return NextResponse.json({ error: "Unsupported provider collection" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cursor = request.nextUrl.searchParams.get("cursor");
    const collection = await loadProviderCollection(
      supabase,
      user.id,
      parsedProvider.data,
      parsedCollection.data,
      cursor
    );

    return NextResponse.json({ collection });
  } catch (error) {
    console.error("Karaoke provider collection error:", error);
    return NextResponse.json(
      { error: "Failed to load karaoke provider collection" },
      { status: 500 }
    );
  }
}
