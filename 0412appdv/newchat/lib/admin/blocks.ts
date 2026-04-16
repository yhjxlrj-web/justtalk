import type { DeveloperBlockEntry } from "@/types/admin";

type UserBlockRow = {
  id: string;
  blocker_user_id: string;
  blocked_user_id: string;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

export async function getDeveloperBlockEntries(client: any): Promise<DeveloperBlockEntry[]> {
  const { data: blockRows, error: blockError } = (await client
    .from("user_blocks")
    .select("id, blocker_user_id, blocked_user_id, created_at")
    .order("created_at", { ascending: false })) as {
    data: UserBlockRow[] | null;
    error: { message?: string } | null;
  };

  if (blockError) {
    console.error("getDeveloperBlockEntries block fetch error", blockError);
    return [];
  }

  const userIds = Array.from(
    new Set(
      (blockRows ?? []).flatMap((row) => [row.blocker_user_id, row.blocked_user_id]).filter(Boolean)
    )
  );

  const { data: profileRows, error: profileError } =
    userIds.length > 0
      ? ((await client
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds)) as {
          data: ProfileRow[] | null;
          error: { message?: string } | null;
        })
      : { data: [], error: null };

  if (profileError) {
    console.error("getDeveloperBlockEntries profile fetch error", profileError);
  }

  const profileMap = new Map((profileRows ?? []).map((row) => [row.id, row]));

  return (blockRows ?? []).map((row) => {
    const blockerProfile = profileMap.get(row.blocker_user_id);
    const blockedProfile = profileMap.get(row.blocked_user_id);

    return {
      id: row.id,
      blocker: {
        id: row.blocker_user_id,
        displayName: blockerProfile?.display_name?.trim() || "Unknown user",
        email: blockerProfile?.email ?? ""
      },
      blockerUserId: row.blocker_user_id,
      blocked: {
        id: row.blocked_user_id,
        displayName: blockedProfile?.display_name?.trim() || "Unknown user",
        email: blockedProfile?.email ?? ""
      },
      blockedUserId: row.blocked_user_id,
      createdAt: row.created_at ?? new Date().toISOString()
    } satisfies DeveloperBlockEntry;
  });
}
