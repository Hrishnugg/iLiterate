import { notFound, redirect } from "next/navigation";
import { KaraokeSetupNotice } from "@/components/karaoke/KaraokeSetupNotice";
import { KaraokeStudio } from "@/components/karaoke/KaraokeStudio";
import {
  getKaraokeErrorMessage,
  isMissingKaraokeSchemaError,
} from "@/lib/karaoke/errors";
import { loadKaraokeItemDetail } from "@/lib/karaoke/item-server";
import { createClient } from "@/lib/supabase/server";

export default async function KaraokeItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let item = null;
  let errorMessage: string | null = null;

  try {
    item = await loadKaraokeItemDetail(supabase, user.id, itemId);
    if (!item) {
      notFound();
    }
  } catch (error) {
    errorMessage = isMissingKaraokeSchemaError(error)
      ? "The dedicated karaoke schema is missing, so this item cannot load yet."
      : getKaraokeErrorMessage(error);
  }

  if (errorMessage) {
    return <KaraokeSetupNotice message={errorMessage} />;
  }

  if (!item) {
    notFound();
  }

  return <KaraokeStudio initialItem={item} />;
}
