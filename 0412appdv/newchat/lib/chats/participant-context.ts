import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/utils/uuid";

export type ChatParticipantContextRow = {
  chat_id: string;
  user_id: string;
  preferred_language_snapshot?: string | null;
  display_name_snapshot?: string | null;
  email_snapshot?: string | null;
  avatar_url_snapshot?: string | null;
};

export type ChatParticipantContextProfile = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  preferred_language?: string | null;
  avatar_url?: string | null;
};

export type ChatParticipantContext = {
  membershipRows: ChatParticipantContextRow[];
  participants: ChatParticipantContextRow[];
  viewerParticipant: ChatParticipantContextRow | null;
  otherParticipant: ChatParticipantContextRow | null;
  viewerHasMembership: boolean;
  profiles: ChatParticipantContextProfile[];
  viewerProfile: ChatParticipantContextProfile | null;
  otherProfile: ChatParticipantContextProfile | null;
};

export async function getChatParticipantContext(params: {
  membershipClient: any;
  chatId: string;
  viewerId: string;
  debugLabel?: string;
}) {
  const { membershipClient, chatId, viewerId, debugLabel = "chat participant context" } = params;

  if (!isUuid(chatId)) {
    console.log(debugLabel, {
      roomId: chatId,
      viewerId,
      reason: "invalid-room-id"
    });

    return {
      membershipRows: [],
      participants: [],
      viewerParticipant: null,
      otherParticipant: null,
      viewerHasMembership: false,
      profiles: [],
      viewerProfile: null,
      otherProfile: null
    } satisfies ChatParticipantContext;
  }

  const { data: membershipRows, error: membershipError } = (await membershipClient
    .from("chat_participants")
    .select(
      "chat_id, user_id, preferred_language_snapshot, display_name_snapshot, email_snapshot, avatar_url_snapshot"
    )
    .eq("chat_id", chatId)) as {
    data: ChatParticipantContextRow[] | null;
    error: { message?: string } | null;
  };

  const resolvedMembershipRows = membershipRows ?? [];
  const viewerHasMembership = resolvedMembershipRows.some((row) => row.user_id === viewerId);

  if (membershipError || !viewerHasMembership) {
    console.log(debugLabel, {
      roomId: chatId,
      viewerId,
      membershipError,
      membershipRows: resolvedMembershipRows,
      viewerHasMembership
    });

    return {
      membershipRows: resolvedMembershipRows,
      participants: [],
      viewerParticipant: null,
      otherParticipant: null,
      viewerHasMembership,
      profiles: [],
      viewerProfile: null,
      otherProfile: null
    } satisfies ChatParticipantContext;
  }

  const admin = createSupabaseAdminClient();
  const { data: participants, error: participantError } = (await admin
    .from("chat_participants")
    .select(
      "chat_id, user_id, preferred_language_snapshot, display_name_snapshot, email_snapshot, avatar_url_snapshot"
    )
    .eq("chat_id", chatId)) as {
    data: ChatParticipantContextRow[] | null;
    error: { message?: string } | null;
  };

  const resolvedParticipants = participants ?? [];
  const viewerParticipant =
    resolvedParticipants.find((participant) => participant.user_id === viewerId) ?? null;
  const otherParticipant =
    resolvedParticipants.find((participant) => participant.user_id !== viewerId) ?? null;

  if (participantError || resolvedParticipants.length === 0) {
    console.log(debugLabel, {
      roomId: chatId,
      viewerId,
      participantError,
      membershipRows: resolvedMembershipRows,
      participants: resolvedParticipants
    });

    return {
      membershipRows: resolvedMembershipRows,
      participants: resolvedParticipants,
      viewerParticipant,
      otherParticipant,
      viewerHasMembership,
      profiles: [],
      viewerProfile: null,
      otherProfile: null
    } satisfies ChatParticipantContext;
  }

  const resolvedProfiles = resolvedParticipants.map((participant) => ({
    id: participant.user_id,
    email: participant.email_snapshot ?? null,
    display_name: participant.display_name_snapshot ?? null,
    preferred_language: participant.preferred_language_snapshot ?? null,
    avatar_url: participant.avatar_url_snapshot ?? null
  })) satisfies ChatParticipantContextProfile[];
  const profileMap = new Map(resolvedProfiles.map((profile) => [profile.id, profile]));
  const viewerProfile = viewerParticipant ? profileMap.get(viewerParticipant.user_id) ?? null : null;
  const otherProfile = otherParticipant ? profileMap.get(otherParticipant.user_id) ?? null : null;

  console.log(debugLabel, {
    roomId: chatId,
    viewerId,
    membershipRows: resolvedMembershipRows,
    membershipRowsLength: resolvedMembershipRows.length,
    participants: resolvedParticipants,
    participantsLength: resolvedParticipants.length,
    viewerParticipant,
    otherParticipant,
    profiles: resolvedProfiles,
    viewerProfile,
    otherProfile
  });

  return {
    membershipRows: resolvedMembershipRows,
    participants: resolvedParticipants,
    viewerParticipant,
    otherParticipant,
    viewerHasMembership,
    profiles: resolvedProfiles,
    viewerProfile,
    otherProfile
  } satisfies ChatParticipantContext;
}
