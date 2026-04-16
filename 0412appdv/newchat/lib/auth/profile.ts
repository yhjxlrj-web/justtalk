import type { User } from "@supabase/supabase-js";

type ProfileRecord = {
  profile_completed?: boolean | null;
  setup_completed?: boolean | null;
  display_name?: string | null;
  username?: string | null;
};

export async function hasCompletedProfileSetup(client: any, user: User) {
  const metadataCompleted =
    user.user_metadata?.profile_completed === true || user.user_metadata?.setup_completed === true;

  if (metadataCompleted) {
    return true;
  }

  const { data, error } = (await client
    .from("profiles")
    .select("profile_completed, setup_completed, display_name, username")
    .eq("id", user.id)
    .maybeSingle()) as { data: ProfileRecord | null; error: { code?: string } | null };

  if (error) {
    return false;
  }

  if (!data) {
    return false;
  }

  return Boolean(
    data.profile_completed ||
      data.setup_completed ||
      (data.display_name && data.display_name.trim()) ||
      (data.username && data.username.trim())
  );
}

export async function getPostLoginRedirectPath(client: any, user: User) {
  const profileComplete = await hasCompletedProfileSetup(client, user);

  return profileComplete ? "/home" : "/profile/setup";
}
