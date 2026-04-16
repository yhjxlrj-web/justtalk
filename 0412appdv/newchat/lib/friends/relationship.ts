import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FriendRelationshipStatus } from "@/types/friends";

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendRelationshipStatus;
};

type UserBlockRow = {
  blocker_user_id: string;
  blocked_user_id: string;
};

function getOtherUserId(row: FriendshipRow, userId: string) {
  return row.requester_id === userId ? row.addressee_id : row.requester_id;
}

export async function getFriendshipBetweenUsers(userId: string, otherUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = (await admin
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`
    )
    .maybeSingle()) as {
    data: FriendshipRow | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "Unable to load friendship state.");
  }

  return data;
}

export async function getRelationshipStatusMapForUser(userId: string, otherUserIds: string[]) {
  if (otherUserIds.length === 0) {
    return new Map<string, FriendRelationshipStatus>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = (await admin
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)) as {
    data: FriendshipRow[] | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "Unable to load friendship states.");
  }

  const targetIds = new Set(otherUserIds);
  const statusMap = new Map<string, FriendRelationshipStatus>();

  for (const row of data ?? []) {
    const otherUserId = getOtherUserId(row, userId);

    if (!targetIds.has(otherUserId)) {
      continue;
    }

    statusMap.set(otherUserId, row.status);
  }

  return statusMap;
}

export async function getBlockedUserIdSetForBlocker(
  blockerUserId: string,
  otherUserIds?: string[]
) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("user_blocks")
    .select("blocker_user_id, blocked_user_id")
    .eq("blocker_user_id", blockerUserId);

  if (otherUserIds && otherUserIds.length > 0) {
    query = query.in("blocked_user_id", otherUserIds);
  }

  const { data, error } = (await query) as {
    data: UserBlockRow[] | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "Unable to load blocked users.");
  }

  return new Set((data ?? []).map((row) => row.blocked_user_id));
}

export async function hasUserBlocked(blockerUserId: string, blockedUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = (await admin
    .from("user_blocks")
    .select("blocker_user_id, blocked_user_id")
    .eq("blocker_user_id", blockerUserId)
    .eq("blocked_user_id", blockedUserId)
    .maybeSingle()) as {
    data: UserBlockRow | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "Unable to load block state.");
  }

  return !!data;
}
