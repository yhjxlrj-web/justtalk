import type { FriendProfileSummary } from "@/types/friends";
import type { CommunityProfileItem } from "@/types/community";

export const COMMUNITY_PROFILE_LIMIT = 30;
const COMMUNITY_PROFILE_LOOKUP_LIMIT = 128;

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

type UserBlockRow = {
  blocker_user_id: string;
  blocked_user_id: string;
};

export function buildCommunityProfileItemFromProfileRow(row: {
  id: string;
  email?: string | null;
  display_name?: string | null;
  status_message?: string | null;
  last_seen_at?: string | null;
  show_last_seen?: boolean | null;
  country?: string | null;
  preferred_language?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}): CommunityProfileItem {
  return {
    id: row.id,
    email: row.email ?? "",
    displayName: row.display_name ?? "Unknown user",
    statusMessage: row.status_message ?? undefined,
    country: row.country ?? "",
    preferredLanguage: row.preferred_language ?? "",
    avatarUrl: row.avatar_url ?? undefined,
    lastActiveAt: row.show_last_seen ? row.last_seen_at ?? undefined : undefined,
    showLastSeen: row.show_last_seen ?? true,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortCommunityProfiles(profiles: CommunityProfileItem[]) {
  return [...profiles].sort((left, right) => {
    const rightActive = toTimestamp(right.lastActiveAt);
    const leftActive = toTimestamp(left.lastActiveAt);

    if (rightActive !== leftActive) {
      return rightActive - leftActive;
    }

    const rightCreated = toTimestamp(right.createdAt);
    const leftCreated = toTimestamp(left.createdAt);

    if (rightCreated !== leftCreated) {
      return rightCreated - leftCreated;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

export type CommunityProfilesResult = {
  hasOverflow: boolean;
  profiles: CommunityProfileItem[];
};

export async function getCommunityProfiles(
  client: any,
  userId: string,
  options?: {
    excludeUserIds?: string[];
    limit?: number;
  }
) : Promise<CommunityProfilesResult> {
  const limit = options?.limit ?? COMMUNITY_PROFILE_LIMIT;
  const excludedUserIds = new Set(options?.excludeUserIds ?? []);

  const [{ data: blocksByViewer, error: blocksByViewerError }, { data: blocksOfViewer, error: blocksOfViewerError }, { data: profileRows, error: profilesError }] =
    await Promise.all([
      client
        .from("user_blocks")
        .select("blocker_user_id, blocked_user_id")
        .eq("blocker_user_id", userId),
      client
        .from("user_blocks")
        .select("blocker_user_id, blocked_user_id")
        .eq("blocked_user_id", userId),
      client
        .from("profiles")
        .select(
          "id, email, display_name, status_message, last_seen_at, show_last_seen, country, preferred_language, avatar_url, profile_completed, created_at, updated_at"
        )
        .eq("profile_completed", true)
        .neq("id", userId)
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(Math.max(limit * 4, COMMUNITY_PROFILE_LOOKUP_LIMIT))
    ]);

  if (blocksByViewerError || blocksOfViewerError) {
    throw new Error(
      blocksByViewerError?.message ??
        blocksOfViewerError?.message ??
        "Unable to load community block state."
    );
  }

  if (profilesError || !profileRows) {
    throw new Error(profilesError?.message ?? "Unable to load community profiles.");
  }

  const hiddenProfileIds = new Set<string>([
    ...(blocksByViewer ?? []).map((row: UserBlockRow) => row.blocked_user_id),
    ...(blocksOfViewer ?? []).map((row: UserBlockRow) => row.blocker_user_id)
  ]);

  const filteredProfiles = sortCommunityProfiles(
    (profileRows as ProfileRow[])
      .filter((row) => !hiddenProfileIds.has(row.id) && !excludedUserIds.has(row.id))
      .map(buildCommunityProfileItemFromProfileRow)
  );

  return {
    hasOverflow: filteredProfiles.length > limit,
    profiles: filteredProfiles.slice(0, limit)
  };
}

export function buildCommunityProfileFromSummary(profile: FriendProfileSummary): CommunityProfileItem {
  return {
    ...profile
  };
}
