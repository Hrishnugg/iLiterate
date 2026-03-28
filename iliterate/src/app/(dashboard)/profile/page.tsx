import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettings } from "@/components/profile-settings";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // First try to get the profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If profile doesn't exist, create one with defaults
  if (!profile) {
    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        native_language: "english",
        target_language: "spanish",
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create profile:", createError);
    } else {
      profile = newProfile;
    }
  }

  const { data: socialProfile } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, avatar_seed, avatar_url, leaderboard_anonymous, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <ProfileSettings
      user={user}
      profile={profile}
      socialProfile={socialProfile}
    />
  );
}
