import { redirect } from "next/navigation";
import { KaraokeCollectionClient } from "@/components/karaoke/KaraokeCollectionClient";
import { KaraokeSetupNotice } from "@/components/karaoke/KaraokeSetupNotice";
import {
  getKaraokeErrorMessage,
  isMissingKaraokeSchemaError,
} from "@/lib/karaoke/errors";
import { loadKaraokeItemSummaries } from "@/lib/karaoke/item-server";
import { createClient } from "@/lib/supabase/server";

export default async function KaraokePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let items = null;
  let errorMessage: string | null = null;

  try {
    items = await loadKaraokeItemSummaries(supabase, user.id);
  } catch (error) {
    errorMessage = isMissingKaraokeSchemaError(error)
      ? "The dedicated karaoke tables are not available in this environment yet."
      : getKaraokeErrorMessage(error);
  }

  if (errorMessage) {
    return <KaraokeSetupNotice message={errorMessage} />;
  }

  return <KaraokeCollectionClient initialItems={items ?? []} />;
}
