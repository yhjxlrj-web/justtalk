import type { UserProfile } from "@/types/profile";

type ProfileRow = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  status_message?: string | null;
  last_seen_at?: string | null;
  show_last_seen?: boolean | null;
  country?: string | null;
  preferred_language?: string | null;
  avatar_url?: string | null;
  profile_completed?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function mapProfileRowToUserProfile(row: ProfileRow | null): UserProfile | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email ?? undefined,
    displayName: row.display_name ?? "",
    statusMessage: row.status_message ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
    showLastSeen: row.show_last_seen ?? true,
    country: row.country ?? "",
    preferredLanguage: row.preferred_language ?? "",
    avatarUrl: row.avatar_url ?? undefined,
    profileCompleted: row.profile_completed ?? false,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getUserProfile(client: any, userId: string) {
  const { data, error } = (await client
    .from("profiles")
    .select(
      "id, email, display_name, status_message, last_seen_at, show_last_seen, country, preferred_language, avatar_url, profile_completed, created_at, updated_at"
    )
    .eq("id", userId)
    .maybeSingle()) as { data: ProfileRow | null; error: { message?: string } | null };

  if (error) {
    return null;
  }

  return mapProfileRowToUserProfile(data);
}

export async function updateProfileLastSeen(client: any, userId: string) {
  const { error } = await client
    .from("profiles")
    .update({
      last_seen_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (error) {
    console.error("Failed to update profile last_seen_at", {
      userId,
      error
    });
  }
}
