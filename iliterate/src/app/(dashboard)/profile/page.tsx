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

  // Get the user's name from auth metadata
  const { data: socialProfile } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, avatar_seed, leaderboard_anonymous, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  const userName =
    socialProfile?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {userName}</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and learning preferences.
        </p>
      </div>
      <ProfileSettings
        user={user}
        profile={profile}
        socialProfile={socialProfile}
      />
    </div>
  );
}
