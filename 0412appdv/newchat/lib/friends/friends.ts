import type {
  FriendCollections,
  FriendListItem,
  FriendProfileSummary,
  FriendRelationship,
  FriendRelationshipStatus
} from "@/types/friends";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type FriendRelationshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendRelationshipStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

type FriendProfileRow = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  status_message?: string | null;
  last_seen_at?: string | null;
  show_last_seen?: boolean | null;
  country?: string | null;
  preferred_language?: string | null;
  avatar_url?: string | null;
};

type UserBlockRow = {
  id: string;
  blocker_user_id: string;
  blocked_user_id: string;
  created_at?: string | null;
};

function mapRelationshipRow(row: FriendRelationshipRow): FriendRelationship {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function mapProfileRow(row: FriendProfileRow): FriendProfileSummary {
  return {
    id: row.id,
    email: row.email ?? "",
    displayName: row.display_name ?? "Unknown user",
    statusMessage: row.status_message ?? undefined,
    country: row.country ?? "",
    preferredLanguage: row.preferred_language ?? "",
    avatarUrl: row.avatar_url ?? undefined,
    lastActiveAt: row.show_last_seen ? row.last_seen_at ?? undefined : undefined,
    showLastSeen: row.show_last_seen ?? true
  };
}

export function getFriendRelationshipStatusLabel(
  status: FriendRelationshipStatus,
  direction: "incoming" | "outgoing"
) {
  if (status === "accepted") {
    return "Friend";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return direction === "incoming" ? "Request received" : "Request sent";
}

function emptyFriendCollections(): FriendCollections {
  return {
    incomingRequests: [],
    sentRequests: [],
    acceptedFriends: [],
    blockedUsers: []
  };
}

async function getRelationshipRowsForCollection(client: any, userId: string) {
  const [sentResult, incomingResult, acceptedResult] = await Promise.all([
    client
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at, updated_at")
      .eq("requester_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    client
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at, updated_at")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    client
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at, updated_at")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted")
      .order("created_at", { ascending: false }),
  ]);

  return {
    sentResult: sentResult as {
      data: FriendRelationshipRow[] | null;
      error: { code?: string; message?: string } | null;
    },
    incomingResult: incomingResult as {
      data: FriendRelationshipRow[] | null;
      error: { code?: string; message?: string } | null;
    },
    acceptedResult: acceptedResult as {
      data: FriendRelationshipRow[] | null;
      error: { code?: string; message?: string } | null;
    }
  };
}

function mapRelationshipItems(
  relationshipRows: FriendRelationshipRow[],
  userId: string,
  profilesById: Map<string, FriendProfileSummary>
): FriendListItem[] {
  return relationshipRows.flatMap((row) => {
    const relationship = mapRelationshipRow(row);
    const otherUserId =
      relationship.requesterId === userId ? relationship.addresseeId : relationship.requesterId;
    const profile = profilesById.get(otherUserId);

    if (!profile) {
      return [];
    }

    return [
      {
        relationship,
        profile,
        direction: relationship.requesterId === userId ? "outgoing" : "incoming"
      }
    ];
  });
}

function mapBlockedItems(
  blockRows: UserBlockRow[],
  profilesById: Map<string, FriendProfileSummary>
): FriendListItem[] {
  return blockRows.flatMap((row) => {
    const profile = profilesById.get(row.blocked_user_id);

    if (!profile) {
      return [];
    }

    return [
      {
        relationship: {
          id: row.id,
          requesterId: row.blocker_user_id,
          addresseeId: row.blocked_user_id,
          status: "blocked",
          createdAt: row.created_at ?? undefined
        },
        profile,
        direction: "outgoing"
      }
    ];
  });
}

export async function getFriendCollections(client: any, userId: string): Promise<FriendCollections> {
  const { acceptedResult, incomingResult, sentResult } = await getRelationshipRowsForCollection(
    client,
    userId
  );
  const sentRows = sentResult.data ?? [];
  const incomingRows = incomingResult.data ?? [];
  const acceptedRows = acceptedResult.data ?? [];
  const relationshipRows = [...incomingRows, ...sentRows, ...acceptedRows];

  if (sentResult.error || incomingResult.error || acceptedResult.error) {
    console.error("getFriendCollections friendship query failure", {
      userId,
      sentResultError: sentResult.error,
      incomingResultError: incomingResult.error,
      acceptedResultError: acceptedResult.error,
      relationshipRowsLength: relationshipRows.length
    });

    return emptyFriendCollections();
  }

  const admin = createSupabaseAdminClient();
  const { data: blockRows, error: blocksError } = (await admin
    .from("user_blocks")
    .select("id, blocker_user_id, blocked_user_id, created_at")
    .eq("blocker_user_id", userId)
    .order("created_at", { ascending: false })) as {
    data: UserBlockRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (blocksError) {
    console.error("getFriendCollections block query failure", {
      userId,
      blocksError
    });

    return emptyFriendCollections();
  }

  const otherUserIds = Array.from(
    new Set(
      relationshipRows.map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id))
    )
  );
  const blockedUserIdsForLookup = (blockRows ?? []).map((row) => row.blocked_user_id);
  const profileLookupIds = Array.from(new Set([...otherUserIds, ...blockedUserIdsForLookup]));

  if (profileLookupIds.length === 0) {
    console.log("getFriendCollections found no visible friendship or block rows", {
      userId,
      relationshipRowsLength: relationshipRows.length,
      sentRowsLength: sentRows.length,
      incomingRowsLength: incomingRows.length,
      acceptedRowsLength: acceptedRows.length,
      blockedRowsLength: (blockRows ?? []).length
    });

    return emptyFriendCollections();
  }

  console.log("getFriendCollections relationship summary", {
    userId,
    relationshipRowsLength: relationshipRows.length,
    sentRowsLength: sentRows.length,
    incomingRowsLength: incomingRows.length,
    acceptedRowsLength: acceptedRows.length,
    blockedRowsLength: (blockRows ?? []).length,
    otherUserIds: profileLookupIds
  });

  const blockedUserIds = new Set((blockRows ?? []).map((row) => row.blocked_user_id));
  const visibleIncomingRows = incomingRows.filter(
    (row) => !blockedUserIds.has(row.requester_id === userId ? row.addressee_id : row.requester_id)
  );
  const visibleSentRows = sentRows.filter(
    (row) => !blockedUserIds.has(row.requester_id === userId ? row.addressee_id : row.requester_id)
  );
  const visibleAcceptedRows = acceptedRows.filter(
    (row) => !blockedUserIds.has(row.requester_id === userId ? row.addressee_id : row.requester_id)
  );
  const { data: profileRows, error: profilesError } = (await admin
    .from("profiles")
    .select(
      "id, email, display_name, status_message, last_seen_at, show_last_seen, country, preferred_language, avatar_url"
    )
    .in("id", profileLookupIds)) as {
    data: FriendProfileRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (profilesError || !profileRows) {
    console.error("getFriendCollections profile query failure", {
      userId,
      profilesError,
      otherUserIds,
      profileRows
    });

    return emptyFriendCollections();
  }

  console.log("getFriendCollections profile summary", {
    userId,
    otherUserIds: profileLookupIds,
    profileRows
  });

  const profilesById = new Map(profileRows.map((row) => [row.id, mapProfileRow(row)]));

  return {
    incomingRequests: mapRelationshipItems(visibleIncomingRows, userId, profilesById),
    sentRequests: mapRelationshipItems(visibleSentRows, userId, profilesById),
    acceptedFriends: mapRelationshipItems(visibleAcceptedRows, userId, profilesById),
    blockedUsers: mapBlockedItems(blockRows ?? [], profilesById)
  };
}
