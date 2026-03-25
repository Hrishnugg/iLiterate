import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UPLOADS_BUCKET } from "@/lib/uploads";
import { ArticleRenderer } from "@/components/reader/ArticleRenderer";

interface ReaderPageProps {
  params: Promise<{
    contentId: string;
  }>;
}

export default async function ReaderContentPage({ params }: ReaderPageProps) {
  const { contentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch content
  const { data: content, error } = await supabase
    .from("content")
    .select("*")
    .eq("id", contentId)
    .single();

  if (error || !content) {
    notFound();
  }

  let sourceImageUrl: string | null = null;
  let sourceImageAlt: string | null = null;

  if (user && content.source_upload_id) {
    const { data: upload } = await supabase
      .from("user_uploads")
      .select("title, original_filename, storage_path, kind, mime_type")
      .eq("id", content.source_upload_id)
      .eq("user_id", user.id)
      .single();

    if (
      upload?.kind === "image" &&
      typeof upload.storage_path === "string" &&
      upload.storage_path.length > 0
    ) {
      const admin = createAdminClient();
      const { data: signedData } = await admin.storage
        .from(UPLOADS_BUCKET)
        .createSignedUrl(upload.storage_path, 60 * 60);

      sourceImageUrl = signedData?.signedUrl ?? null;
      sourceImageAlt =
        upload.title?.trim() ||
        upload.original_filename?.trim() ||
        content.title ||
        "Imported source image";
    }
  }

  return (
    <ArticleRenderer
      content={content}
      sourceImageUrl={sourceImageUrl}
      sourceImageAlt={sourceImageAlt}
    />
  );
}
