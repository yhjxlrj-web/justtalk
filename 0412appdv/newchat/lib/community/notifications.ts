import type { CommunityNotificationItem, CommunityProfileItem } from "@/types/community";

type CommunityNotificationRow = {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  sender_display_name?: string | null;
  sender_avatar_url?: string | null;
  type: "heart";
  created_at?: string | null;
};

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
  created_at?: string | null;
  updated_at?: string | null;
};

function mapProfileRow(row: ProfileRow): CommunityProfileItem {
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

function buildFallbackSenderProfile(row: CommunityNotificationRow): CommunityProfileItem {
  return {
    id: row.sender_user_id,
    email: "",
    displayName: row.sender_display_name ?? "JustTalk user",
    statusMessage: undefined,
    country: "",
    preferredLanguage: "",
    avatarUrl: row.sender_avatar_url ?? undefined,
    lastActiveAt: undefined,
    createdAt: undefined,
    updatedAt: undefined
  };
}

export async function getCommunityNotifications(client: any, userId: string) {
  const { data: notificationRows, error: notificationError } = (await client
    .from("community_notifications")
    .select(
      "id, sender_user_id, receiver_user_id, sender_display_name, sender_avatar_url, type, created_at"
    )
    .eq("receiver_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)) as {
    data: CommunityNotificationRow[] | null;
    error: { message?: string } | null;
  };

  if (notificationError) {
    throw new Error(notificationError.message ?? "Unable to load community notifications.");
  }

  console.log("community notification fetch result", {
    receiverUserId: userId,
    notificationCount: notificationRows?.length ?? 0,
    receiverNotificationIds: (notificationRows ?? []).map((row) => row.id)
  });

  if (!notificationRows || notificationRows.length === 0) {
    return [] as CommunityNotificationItem[];
  }

  const senderIds = Array.from(new Set(notificationRows.map((row) => row.sender_user_id)));
  const { data: profileRows, error: profileError } = (await client
    .from("profiles")
    .select(
      "id, email, display_name, status_message, last_seen_at, show_last_seen, country, preferred_language, avatar_url, created_at, updated_at"
    )
    .in("id", senderIds)) as {
    data: ProfileRow[] | null;
    error: { message?: string } | null;
  };

  if (profileError) {
    throw new Error(profileError.message ?? "Unable to load notification senders.");
  }

  const senderProfilesById = new Map(
    (profileRows ?? []).map((row) => [row.id, mapProfileRow(row)])
  );

  const notifications = notificationRows
    .flatMap((row) => {
      const senderProfile =
        senderProfilesById.get(row.sender_user_id) ?? buildFallbackSenderProfile(row);

      return [
        {
          id: row.id,
          receiverUserId: row.receiver_user_id,
          senderUserId: row.sender_user_id,
          senderProfile: {
            ...senderProfile,
            displayName: row.sender_display_name ?? senderProfile.displayName,
            avatarUrl: row.sender_avatar_url ?? senderProfile.avatarUrl
          },
          createdAt: toTimestamp(row.created_at),
          type: row.type
        } satisfies CommunityNotificationItem
      ];
    })
    .sort((left, right) => right.createdAt - left.createdAt);

  console.log("community notification receiver filter", {
    receiverUserId: userId,
    resultCount: notifications.length,
    senderUserIds: notifications.map((item) => item.senderUserId)
  });

  return notifications;
}

export async function getSentCommunityHeartReceiverIds(
  client: any,
  userId: string,
  receiverUserIds?: string[]
) {
  let query = client
    .from("community_notifications")
    .select("receiver_user_id")
    .eq("sender_user_id", userId)
    .eq("type", "heart");

  if (receiverUserIds && receiverUserIds.length > 0) {
    query = query.in("receiver_user_id", receiverUserIds);
  }

  const { data, error } = (await query) as {
    data: Array<{ receiver_user_id: string }> | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "Unable to load sent community hearts.");
  }

  const sentReceiverIds = (data ?? []).map((row) => row.receiver_user_id);

  console.log("community heart sent-state result", {
    senderUserId: userId,
    receiverUserIds: receiverUserIds ?? [],
    sentReceiverIds
  });

  return new Set(sentReceiverIds);
}
