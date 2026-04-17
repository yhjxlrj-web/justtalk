import { getChatParticipantContext } from "@/lib/chats/participant-context";
import {
  ensureChatRoomSummaries,
  isChatRoomSummaryUnavailableError
} from "@/lib/chats/room-summary";
import {
  getBlockedUserIdSetForBlocker,
  getFriendshipBetweenUsers,
  hasUserBlocked
} from "@/lib/friends/relationship";
import { getServerAuthLocale } from "@/lib/i18n/auth-locale-server";
import { getLocaleLabel } from "@/lib/i18n/get-dictionary";
import type { SupportedLocale } from "@/lib/i18n/messages";
import { formatChatTimestamp } from "@/lib/messages/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/utils/uuid";
import type { ChatRoomSummary } from "@/types/chat";
import type { ChatRoomPreview } from "@/types/home";

type ChatRow = {
  id: string;
  title?: string | null;
  avatar_url?: string | null;
  updated_at?: string | null;
  chat_type?: "direct" | "group" | null;
};

type ChatParticipantRow = {
  chat_id: string;
  user_id: string;
  last_seen_at?: string | null;
  preferred_language_snapshot?: string | null;
  display_name_snapshot?: string | null;
  email_snapshot?: string | null;
  avatar_url_snapshot?: string | null;
};

type ProfileRow = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  preferred_language?: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
  show_last_seen?: boolean | null;
};

type MessageRow = {
  id: string;
  chat_id: string;
  sender_id?: string | null;
  original_text?: string | null;
  original_language?: string | null;
  created_at?: string | null;
  message_kind?: "text" | "image" | null;
};

type TranslationRow = {
  message_id: string;
  target_user_id: string;
  target_language?: string | null;
  translated_text?: string | null;
};

type ChatRoomSummaryRow = {
  room_id: string;
  user_id: string;
  peer_user_id?: string | null;
  peer_display_name_snapshot?: string | null;
  peer_avatar_snapshot?: string | null;
  peer_preferred_language_snapshot?: string | null;
  last_message_id?: string | null;
  last_message_preview?: string | null;
  last_message_created_at?: string | null;
  unread_count?: number | null;
  updated_at?: string | null;
};

function getRelatedProfileForDirectChat(
  allParticipantRows: ChatParticipantRow[],
  profileMap: Map<string, ProfileRow>,
  roomId: string,
  userId: string
) {
  const relatedParticipant = allParticipantRows.find(
    (participant) => participant.chat_id === roomId && participant.user_id !== userId
  );

  return relatedParticipant ? profileMap.get(relatedParticipant.user_id) : undefined;
}

function mapRoomRowToPreview(
  row: ChatRow,
  index: number,
  peerUserId: string | undefined,
  latestMessageId: string | undefined,
  latestMessagePreview: string,
  recipientName: string,
  recipientAvatarUrl?: string,
  latestMessageAt?: string | null,
  peerLastSeenAt?: string | null,
  unreadCount?: number,
  viewerLastSeenAt?: string | null
): ChatRoomPreview {
  return {
    id: `chat-preview-${row.id}`,
    roomId: row.id,
    peerUserId,
    recipientName,
    recipientAvatarUrl: recipientAvatarUrl ?? row.avatar_url ?? undefined,
    latestMessagePreview,
    latestMessageAt: latestMessageAt ? formatChatTimestamp(latestMessageAt) : "Just now",
    latestMessageCreatedAt: latestMessageAt ?? undefined,
    peerLastSeenAt: peerLastSeenAt ?? undefined,
    viewerLastSeenAt: viewerLastSeenAt ?? undefined,
    lastMessageId: latestMessageId,
    unreadCount: unreadCount ?? 0,
    selected: index === 0
  };
}

function toChatSortTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

async function getChatRoomPreviewsFromSummaryRows(client: any, userId: string) {
  const { data: participantRows, error: participantError } = await getVerifiedChatMemberships(
    client,
    userId
  );

  if (participantError) {
    console.error("getChatRoomPreviews summary membership error", participantError);
    return [] as ChatRoomPreview[];
  }

  const chatIds = participantRows?.map((row) => row.chat_id) ?? [];

  if (chatIds.length === 0) {
    return [] as ChatRoomPreview[];
  }

  const { data: chatRows, error: chatError } = (await client
    .from("chats")
    .select("id, title, avatar_url, updated_at, chat_type")
    .in("id", chatIds)
    .order("updated_at", { ascending: false })) as {
    data: ChatRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (chatError || !chatRows) {
    console.error("getChatRoomPreviews summary chats error", chatError);
    return [] as ChatRoomPreview[];
  }

  const summarySelect =
    "room_id, user_id, peer_user_id, peer_display_name_snapshot, peer_avatar_snapshot, peer_preferred_language_snapshot, last_message_id, last_message_preview, last_message_created_at, unread_count, updated_at";
  const { data: summaryRows, error: summaryError } = (await client
    .from("chat_room_summaries")
    .select(summarySelect)
    .eq("user_id", userId)
    .in("room_id", chatIds)) as {
    data: ChatRoomSummaryRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (summaryError) {
    if (isChatRoomSummaryUnavailableError(summaryError)) {
      return null;
    }

    console.error("getChatRoomPreviews summary query error", {
      userId,
      summaryError
    });
    return null;
  }

  let resolvedSummaryRows = summaryRows ?? [];
  const summaryByRoomId = new Map(resolvedSummaryRows.map((row) => [row.room_id, row]));
  const missingSummaryRoomIds = chatRows
    .map((row) => row.id)
    .filter((roomId) => !summaryByRoomId.has(roomId));

  if (missingSummaryRoomIds.length > 0) {
    for (const roomId of missingSummaryRoomIds) {
      await ensureChatRoomSummaries(roomId);
    }

    const { data: reloadedSummaryRows, error: reloadSummaryError } = (await client
      .from("chat_room_summaries")
      .select(summarySelect)
      .eq("user_id", userId)
      .in("room_id", chatIds)) as {
      data: ChatRoomSummaryRow[] | null;
      error: { code?: string; message?: string } | null;
    };

    if (reloadSummaryError) {
      if (isChatRoomSummaryUnavailableError(reloadSummaryError)) {
        return null;
      }

      console.error("getChatRoomPreviews summary reload error", {
        userId,
        reloadSummaryError
      });
      return null;
    }

    resolvedSummaryRows = reloadedSummaryRows ?? [];
    summaryByRoomId.clear();
    for (const row of resolvedSummaryRows) {
      summaryByRoomId.set(row.room_id, row);
    }
  }

  const directRoomsWithoutPeerSummary = chatRows
    .filter((row) => row.chat_type === "direct")
    .map((row) => row.id)
    .filter((roomId) => !(summaryByRoomId.get(roomId)?.peer_user_id));

  const peerUserIdByRoomId = new Map<string, string>();

  for (const row of resolvedSummaryRows) {
    if (row.peer_user_id) {
      peerUserIdByRoomId.set(row.room_id, row.peer_user_id);
    }
  }

  if (directRoomsWithoutPeerSummary.length > 0) {
    const { data: directPeerRows, error: directPeerError } = (await client
      .from("chat_participants")
      .select("chat_id, user_id")
      .in("chat_id", directRoomsWithoutPeerSummary)
      .neq("user_id", userId)) as {
      data: Array<{ chat_id: string; user_id: string }> | null;
      error: { code?: string; message?: string } | null;
    };

    if (directPeerError) {
      console.error("getChatRoomPreviews direct peer fallback error", {
        userId,
        directPeerError
      });
      return null;
    }

    for (const row of directPeerRows ?? []) {
      peerUserIdByRoomId.set(row.chat_id, row.user_id);
    }
  }

  const directPeerIds = chatRows
    .filter((row) => row.chat_type === "direct")
    .map((row) => peerUserIdByRoomId.get(row.id))
    .filter(Boolean) as string[];

  let blockedUserIds = new Set<string>();

  if (directPeerIds.length > 0) {
    try {
      blockedUserIds = await getBlockedUserIdSetForBlocker(userId, directPeerIds);
    } catch (error) {
      console.error("getChatRoomPreviews summary block lookup error", {
        userId,
        error
      });
    }
  }

  const { data: peerPresenceRows, error: peerPresenceError } =
    directPeerIds.length > 0
      ? ((await client
          .from("profiles")
          .select("id, last_seen_at, show_last_seen")
          .in("id", directPeerIds)) as {
          data: ProfileRow[] | null;
          error: { code?: string; message?: string } | null;
        })
      : { data: [], error: null };

  if (peerPresenceError) {
    console.error("getChatRoomPreviews summary peer presence error", peerPresenceError);
  }

  const peerLastSeenByUserId = new Map(
    (peerPresenceRows ?? [])
      .filter((row) => row.show_last_seen !== false && !!row.last_seen_at)
      .map((row) => [row.id, row.last_seen_at ?? null])
  );
  const viewerLastSeenByRoomId = new Map(
    (participantRows ?? []).map((row) => [row.chat_id, row.last_seen_at ?? null])
  );

  const unsortedPreviews = chatRows.flatMap((row) => {
    const summary = summaryByRoomId.get(row.id);
    const peerUserId = peerUserIdByRoomId.get(row.id);

    if (row.chat_type === "direct" && peerUserId && blockedUserIds.has(peerUserId)) {
      return [];
    }

    const latestMessageCreatedAt =
      summary?.last_message_created_at ?? summary?.updated_at ?? row.updated_at ?? undefined;

    return [
      {
        id: `chat-preview-${row.id}`,
        roomId: row.id,
        peerUserId,
        recipientName:
          summary?.peer_display_name_snapshot?.trim() || row.title || "Untitled chat",
        recipientAvatarUrl:
          summary?.peer_avatar_snapshot ?? row.avatar_url ?? undefined,
        latestMessagePreview:
          summary?.last_message_preview?.trim() || "No messages yet.",
        latestMessageAt: latestMessageCreatedAt
          ? formatChatTimestamp(latestMessageCreatedAt)
          : "Just now",
        latestMessageCreatedAt,
        peerLastSeenAt: peerUserId
          ? peerLastSeenByUserId.get(peerUserId) ?? undefined
          : undefined,
        viewerLastSeenAt: viewerLastSeenByRoomId.get(row.id) ?? undefined,
        lastMessageId: summary?.last_message_id ?? undefined,
        unreadCount: Math.max(0, summary?.unread_count ?? 0),
        selected: false
      } satisfies ChatRoomPreview
    ];
  });

  const sortedPreviews = [...unsortedPreviews].sort((left, right) => {
    const leftTimestamp = toChatSortTimestamp(left.latestMessageCreatedAt);
    const rightTimestamp = toChatSortTimestamp(right.latestMessageCreatedAt);
    return rightTimestamp - leftTimestamp;
  });

  return sortedPreviews.map((preview, index) => ({
    ...preview,
    selected: index === 0
  }));
}

function resolvePresenceLocale(
  preferredLanguage: string | null | undefined,
  fallbackLocale: SupportedLocale
): SupportedLocale {
  const normalized = preferredLanguage?.trim().toLowerCase() ?? "";

  if (normalized === "ko" || normalized.startsWith("ko")) {
    return "ko";
  }

  if (normalized === "es" || normalized.startsWith("es")) {
    return "es";
  }

  if (normalized === "en" || normalized.startsWith("en")) {
    return "en";
  }

  return fallbackLocale;
}

const ONLINE_ACTIVITY_WINDOW_MS = 2 * 60 * 1000;

function formatRelativePeerPresenceLabel(
  lastSeenAt: string,
  locale: SupportedLocale,
  isOnline: boolean
) {
  const lastSeenTime = new Date(lastSeenAt).getTime();

  if (Number.isNaN(lastSeenTime)) {
    return "";
  }

  if (isOnline) {
    if (locale === "ko") {
      return "온라인";
    }

    if (locale === "es") {
      return "En linea";
    }

    return "Online";
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - lastSeenTime) / 60000));

  if (locale === "ko") {
    if (diffMinutes < 60) {
      return `${Math.max(1, diffMinutes)}분 전 접속`;
    }

    if (diffMinutes <= 5 * 60) {
      return `${Math.max(1, Math.floor(diffMinutes / 60))}시간 전 접속`;
    }

    if (diffMinutes <= 24 * 60) {
      return "최근 접속함";
    }

    return `${Math.max(1, Math.floor(diffMinutes / (24 * 60)))}일 전 접속`;
  }

  if (locale === "es") {
    if (diffMinutes < 60) {
      return `Activo hace ${Math.max(1, diffMinutes)} min`;
    }

    if (diffMinutes <= 5 * 60) {
      const hours = Math.max(1, Math.floor(diffMinutes / 60));
      return `Activo hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
    }

    if (diffMinutes <= 24 * 60) {
      return "Activo recientemente";
    }

    const days = Math.max(1, Math.floor(diffMinutes / (24 * 60)));
    return `Activo hace ${days} ${days === 1 ? "dia" : "dias"}`;
  }

  if (diffMinutes < 60) {
    return `Active ${Math.max(1, diffMinutes)} min ago`;
  }

  if (diffMinutes <= 5 * 60) {
    const hours = Math.max(1, Math.floor(diffMinutes / 60));
    return `Active ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  if (diffMinutes <= 24 * 60) {
    return "Recently active";
  }

  const days = Math.max(1, Math.floor(diffMinutes / (24 * 60)));
  return `Active ${days} ${days === 1 ? "day" : "days"} ago`;
}

async function getVerifiedChatMemberships(client: any, userId: string, chatId?: string) {
  let query = client
    .from("chat_participants")
    .select("chat_id, user_id, last_seen_at")
    .eq("user_id", userId);

  if (chatId) {
    query = query.eq("chat_id", chatId);
  }

  const result = (await query) as {
    data: ChatParticipantRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  return result;
}

async function getParticipantsAndProfilesWithAdmin(chatIds: string[]) {
  const admin = createSupabaseAdminClient();

  const { data: participantRows, error: participantError } = (await admin
    .from("chat_participants")
    .select(
      "chat_id, user_id, preferred_language_snapshot, display_name_snapshot, email_snapshot, avatar_url_snapshot"
    )
    .in("chat_id", chatIds)) as {
    data: ChatParticipantRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (participantError || !participantRows) {
    return {
      participantRows: [] as ChatParticipantRow[],
      participantError,
      profileRows: [] as ProfileRow[],
      profileError: participantError
    };
  }

  return {
    participantRows,
    participantError: null,
    profileRows: participantRows.map((row) => ({
      id: row.user_id,
      email: row.email_snapshot ?? null,
      display_name: row.display_name_snapshot ?? null,
      preferred_language: row.preferred_language_snapshot ?? null,
      avatar_url: row.avatar_url_snapshot ?? null
    })) satisfies ProfileRow[],
    profileError: null
  };
}

export async function getChatRoomPreviews(client: any, userId: string): Promise<ChatRoomPreview[]> {
  const summaryPreviews = await getChatRoomPreviewsFromSummaryRows(client, userId);

  if (summaryPreviews !== null) {
    return summaryPreviews;
  }

  const { data: participantRows, error: participantError } = await getVerifiedChatMemberships(
    client,
    userId
  );

  if (participantError) {
    console.error("getChatRoomPreviews membership error", participantError);
    return [];
  }

  const chatIds = participantRows?.map((row) => row.chat_id) ?? [];

  if (chatIds.length === 0) {
    return [];
  }

  const { data: chatRows, error: chatError } = (await client
    .from("chats")
    .select("id, title, avatar_url, updated_at, chat_type")
    .in("id", chatIds)
    .order("updated_at", { ascending: false })) as {
    data: ChatRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (chatError || !chatRows) {
    console.error("getChatRoomPreviews chats error", chatError);
    return [];
  }

  const {
    participantRows: allParticipantRows,
    participantError: allParticipantsError,
    profileRows,
    profileError
  } = await getParticipantsAndProfilesWithAdmin(chatIds);

  if (allParticipantsError || profileError) {
    console.error("getChatRoomPreviews admin participant/profile error", {
      allParticipantsError,
      profileError
    });
    return [];
  }

  const { data: messageRows, error: messageError } = (await client
    .from("messages")
    .select("id, chat_id, sender_id, original_text, original_language, created_at, message_kind")
    .in("chat_id", chatIds)
    .order("created_at", { ascending: false })) as {
    data: MessageRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (messageError) {
    console.error("getChatRoomPreviews messages error", messageError);
  }

  const messageIds = (messageRows ?? []).map((message) => message.id);

  const { data: translationRows, error: translationError } =
    messageIds.length > 0
      ? ((await client
          .from("message_translations")
          .select("message_id, target_user_id, target_language, translated_text")
          .eq("target_user_id", userId)
          .in("message_id", messageIds)) as {
          data: TranslationRow[] | null;
          error: { code?: string; message?: string } | null;
        })
      : { data: [], error: null };

  if (translationError) {
    console.error("getChatRoomPreviews translations error", translationError);
  }

  if (chatRows.length === 0) {
    return [];
  }

  const profileMap = new Map((profileRows ?? []).map((row) => [row.id, row]));
  const latestMessageByChat = new Map<string, MessageRow>();
  const translationMap = new Map((translationRows ?? []).map((row) => [row.message_id, row]));
  const lastSeenByChatId = new Map(
    (participantRows ?? []).map((row) => [row.chat_id, row.last_seen_at ?? null])
  );
  const unreadCountByChatId = new Map<string, number>();
  const directChatPeerIds = chatRows
    .filter((row) => row.chat_type === "direct")
    .map((row) => getRelatedProfileForDirectChat(allParticipantRows, profileMap, row.id, userId)?.id)
    .filter(Boolean) as string[];
  let blockedUserIds = new Set<string>();

  if (directChatPeerIds.length > 0) {
    try {
      blockedUserIds = await getBlockedUserIdSetForBlocker(userId, directChatPeerIds);
    } catch (error) {
      console.error("getChatRoomPreviews block lookup error", { userId, error });
    }
  }

  const { data: peerPresenceRows, error: peerPresenceError } =
    directChatPeerIds.length > 0
      ? ((await client
          .from("profiles")
          .select("id, last_seen_at, show_last_seen")
          .in("id", directChatPeerIds)) as {
          data: ProfileRow[] | null;
          error: { code?: string; message?: string } | null;
        })
      : { data: [], error: null };

  if (peerPresenceError) {
    console.error("getChatRoomPreviews peer presence error", peerPresenceError);
  }

  const peerLastSeenByUserId = new Map(
    (peerPresenceRows ?? [])
      .filter((row) => row.show_last_seen !== false && !!row.last_seen_at)
      .map((row) => [row.id, row.last_seen_at ?? null])
  );

  const peerUserIdByRoomId = new Map<string, string>();

  for (const row of chatRows) {
    if (row.chat_type !== "direct") {
      continue;
    }

    const peerId = getRelatedProfileForDirectChat(allParticipantRows, profileMap, row.id, userId)?.id;

    if (peerId) {
      peerUserIdByRoomId.set(row.id, peerId);
    }
  }

  const blockedRoomIds = new Set(
    chatRows
      .filter((row) => {
        const peerId = peerUserIdByRoomId.get(row.id);
        return !!peerId && blockedUserIds.has(peerId);
      })
      .map((row) => row.id)
  );

  for (const message of messageRows ?? []) {
    if (blockedRoomIds.has(message.chat_id)) {
      continue;
    }

    if (!latestMessageByChat.has(message.chat_id)) {
      latestMessageByChat.set(message.chat_id, message);
    }

    const lastSeenAt = lastSeenByChatId.get(message.chat_id) ?? null;
    const isUnread =
      message.sender_id !== userId &&
      (lastSeenAt === null ||
        (message.created_at != null &&
          new Date(message.created_at).getTime() > new Date(lastSeenAt).getTime()));

    if (isUnread) {
      unreadCountByChatId.set(message.chat_id, (unreadCountByChatId.get(message.chat_id) ?? 0) + 1);
    }
  }

  console.log("getChatRoomPreviews block context", {
    viewerId: userId,
    blockedPeerUserIds: Array.from(blockedUserIds),
    blockedRoomIds: Array.from(blockedRoomIds),
    unreadCountRoomIds: Array.from(unreadCountByChatId.keys()),
    previewRoomIdsBeforeFilter: chatRows.map((row) => row.id)
  });

  const previews = chatRows.flatMap((row, index) => {
    const relatedProfile = getRelatedProfileForDirectChat(
      allParticipantRows,
      profileMap,
      row.id,
      userId
    );

    if (
      row.chat_type === "direct" &&
      relatedProfile &&
      blockedUserIds.has(relatedProfile.id)
    ) {
      return [];
    }

    const latestMessage = latestMessageByChat.get(row.id);
    const latestTranslation = latestMessage ? translationMap.get(latestMessage.id) : undefined;
    const previewText =
      latestMessage?.message_kind === "image"
        ? "Photo"
        : latestMessage?.sender_id === userId
        ? latestMessage?.original_text ?? "No messages yet."
        : latestTranslation?.translated_text ??
      latestMessage?.original_text ??
          "No messages yet.";

    return [
      mapRoomRowToPreview(
        row,
        index,
        relatedProfile?.id,
        latestMessage?.id,
        previewText,
        relatedProfile?.display_name ?? row.title ?? "Untitled chat",
        relatedProfile?.avatar_url ?? undefined,
        latestMessage?.created_at ?? row.updated_at,
        relatedProfile?.id ? peerLastSeenByUserId.get(relatedProfile.id) ?? undefined : undefined,
        unreadCountByChatId.get(row.id) ?? 0,
        lastSeenByChatId.get(row.id) ?? undefined
      )
    ];
    }).filter((preview) => {
    const isBlockedPreview = !!preview.peerUserId && blockedUserIds.has(preview.peerUserId);
    return !isBlockedPreview;
  });

  console.log("getChatRoomPreviews result", {
    viewerId: userId,
    previewRoomIdsAfterFilter: previews.map((preview) => preview.roomId),
    previewCount: previews.length
  });

  return previews;
}

export async function getLightweightChatRoomEntryData(
  client: any,
  roomId: string,
  userId: string
): Promise<ChatRoomSummary | null> {
  if (!isUuid(roomId)) {
    return null;
  }

  const { data: membershipRows, error: membershipError } = await getVerifiedChatMemberships(
    client,
    userId,
    roomId
  );

  if (membershipError || !membershipRows?.length) {
    return null;
  }

  const [{ data: chatRow, error: chatError }, { data: summaryRow }] = await Promise.all([
    client
      .from("chats")
      .select("id, title, avatar_url, chat_type")
      .eq("id", roomId)
      .maybeSingle(),
    client
      .from("chat_room_summaries")
      .select(
        "room_id, user_id, peer_user_id, peer_display_name_snapshot, peer_avatar_snapshot, peer_preferred_language_snapshot, last_message_id, last_message_preview, last_message_created_at, unread_count, updated_at"
      )
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (chatError || !chatRow) {
    return null;
  }

  let peerUserId = summaryRow?.peer_user_id ?? null;
  let peerDisplayName = summaryRow?.peer_display_name_snapshot?.trim() ?? "";
  let peerAvatarUrl = summaryRow?.peer_avatar_snapshot ?? null;
  let peerLanguageSnapshot = summaryRow?.peer_preferred_language_snapshot ?? null;

  if (!peerUserId || !peerDisplayName || !peerAvatarUrl || !peerLanguageSnapshot) {
    const { data: fallbackPeerRow } = await client
      .from("chat_participants")
      .select(
        "user_id, display_name_snapshot, avatar_url_snapshot, preferred_language_snapshot"
      )
      .eq("chat_id", roomId)
      .neq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (fallbackPeerRow) {
      peerUserId = peerUserId ?? fallbackPeerRow.user_id ?? null;
      peerDisplayName = peerDisplayName || fallbackPeerRow.display_name_snapshot?.trim() || "";
      peerAvatarUrl = peerAvatarUrl ?? fallbackPeerRow.avatar_url_snapshot ?? null;
      peerLanguageSnapshot =
        peerLanguageSnapshot ?? fallbackPeerRow.preferred_language_snapshot ?? null;
    }
  }

  const roomName = peerDisplayName || chatRow.title?.trim() || "Conversation";
  const peerLanguage = peerLanguageSnapshot ? getLocaleLabel(peerLanguageSnapshot) : undefined;
  const avatarUrl = peerAvatarUrl ?? chatRow.avatar_url ?? undefined;

  return {
    id: roomId,
    name: roomName,
    topic: "",
    languagePair: "",
    avatarUrl,
    unreadCount: Math.max(0, summaryRow?.unread_count ?? 0),
    peerLanguage,
    peerProfile: peerUserId
      ? {
          id: peerUserId,
          displayName: roomName,
          country: "",
          preferredLanguage: peerLanguage ?? "",
          avatarUrl: avatarUrl ?? undefined,
          showLastSeen: true
        }
      : undefined
  };
}

export async function getChatRoomSummary(
  client: any,
  roomId: string,
  userId: string
): Promise<ChatRoomSummary | null> {
  if (!isUuid(roomId)) {
    console.error("getChatRoomSummary invalid roomId", { roomId, userId });
    return null;
  }

  const { data: chatRow, error: chatError } = (await client
    .from("chats")
    .select("id, title, avatar_url, chat_type")
    .eq("id", roomId)
    .maybeSingle()) as {
    data: ChatRow | null;
    error: { message?: string } | null;
  };

  if (chatError || !chatRow) {
    console.error("getChatRoomSummary chat error", { roomId, chatError });
    return null;
  }

  const fallbackLocale = await getServerAuthLocale();

  const { data: membershipRows, error: membershipError } = await getVerifiedChatMemberships(
    client,
    userId,
    roomId
  );

  if (membershipError || !membershipRows?.length) {
    console.error("getChatRoomSummary membership error", {
      roomId,
      userId,
      membershipError,
      membershipRows
    });
    return null;
  }

  const context = await getChatParticipantContext({
    membershipClient: client,
    chatId: roomId,
    viewerId: userId,
    debugLabel: "getChatRoomSummary participant context"
  });

  if (context.participants.length === 0) {
    console.error("getChatRoomSummary participant/profile error", {
      roomId,
      userId,
      membershipRowsLength: context.membershipRows.length,
      participantRowsLength: context.participants.length,
      viewerHasMembership: context.viewerHasMembership,
      otherParticipant: context.otherParticipant,
      otherProfile: context.otherProfile
    });
    return null;
  }

  const relatedProfile = context.otherProfile;
  const viewerParticipant = context.viewerParticipant;
  const otherParticipant = context.otherParticipant;
  const locale = resolvePresenceLocale(
    viewerParticipant?.preferred_language_snapshot ?? context.viewerProfile?.preferred_language,
    fallbackLocale
  );

  if (chatRow.chat_type === "direct" && otherParticipant) {
    try {
      const isBlockedByViewer = await hasUserBlocked(userId, otherParticipant.user_id);

      if (isBlockedByViewer) {
        console.error("getChatRoomSummary blocked by viewer", {
          roomId,
          userId,
          otherUserId: otherParticipant.user_id
        });
        return null;
      }
    } catch (error) {
      console.error("getChatRoomSummary relationship check failed", {
        roomId,
        userId,
        otherUserId: otherParticipant.user_id,
        error
      });
      return null;
    }
  }

  if (!relatedProfile) {
    console.error("getChatRoomSummary relatedProfile missing", {
      roomId,
      userId,
      participantRows: context.participants,
      profileRows: context.profiles,
      otherParticipant
    });

    const fallbackName =
      chatRow.title?.trim() || otherParticipant?.user_id || "Direct conversation";

    return {
      id: roomId,
      name: fallbackName,
      topic: "",
      languagePair: "Language preference pending",
      avatarUrl: chatRow.avatar_url ?? undefined
    };
  }

  const roomName =
    relatedProfile.display_name?.trim() ||
    chatRow.title?.trim() ||
    "Direct conversation";
  const languagePair = relatedProfile.preferred_language
    ? `Your messages translate into ${getLocaleLabel(relatedProfile.preferred_language)}`
    : "Language preference pending";
  let topic = "";
  let peerProfile: ChatRoomSummary["peerProfile"];

  if (otherParticipant) {
    const { data: presenceProfile, error: presenceError } = (await client
      .from("profiles")
      .select(
        "display_name, status_message, country, preferred_language, avatar_url, last_seen_at, show_last_seen"
      )
      .eq("id", otherParticipant.user_id)
      .maybeSingle()) as {
      data:
        | {
            display_name?: string | null;
            status_message?: string | null;
            country?: string | null;
            preferred_language?: string | null;
            avatar_url?: string | null;
            last_seen_at?: string | null;
            show_last_seen?: boolean | null;
          }
        | null;
      error: { message?: string } | null;
    };

    if (presenceError) {
      console.error("getChatRoomSummary presence lookup failed", {
        roomId,
        userId,
        otherUserId: otherParticipant.user_id,
        presenceError
      });
    } else {
      const canShowLastSeen = presenceProfile?.show_last_seen !== false;

      peerProfile = {
        id: otherParticipant.user_id,
        displayName:
          presenceProfile?.display_name?.trim() ||
          relatedProfile.display_name?.trim() ||
          roomName,
        statusMessage: presenceProfile?.status_message ?? undefined,
        country: presenceProfile?.country ?? "",
        preferredLanguage:
          presenceProfile?.preferred_language ??
          relatedProfile.preferred_language ??
          "",
        avatarUrl:
          presenceProfile?.avatar_url ??
          relatedProfile.avatar_url ??
          chatRow.avatar_url ??
          undefined,
        lastSeenAt: canShowLastSeen ? presenceProfile?.last_seen_at ?? undefined : undefined,
        showLastSeen: canShowLastSeen
      };
    }

    if (presenceProfile?.show_last_seen) {
      const { data: latestChatPresenceRows, error: latestChatPresenceError } = (await client
        .from("chat_participants")
        .select("last_seen_at")
        .eq("user_id", otherParticipant.user_id)
        .not("last_seen_at", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(1)) as {
        data: Array<{ last_seen_at?: string | null }> | null;
        error: { message?: string } | null;
      };

      if (latestChatPresenceError) {
        console.error("getChatRoomSummary latest chat presence lookup failed", {
          roomId,
          userId,
          otherUserId: otherParticipant.user_id,
          latestChatPresenceError
        });
      }

      const latestActivityCandidates = [
        presenceProfile.last_seen_at,
        latestChatPresenceRows?.[0]?.last_seen_at ?? null
      ].filter(Boolean) as string[];
      const latestActivityAt =
        latestActivityCandidates.length > 0
          ? latestActivityCandidates.reduce((latest, current) =>
              new Date(current).getTime() > new Date(latest).getTime() ? current : latest
            )
          : null;

      if (latestActivityAt) {
        const isOnline =
          Date.now() - new Date(latestActivityAt).getTime() <= ONLINE_ACTIVITY_WINDOW_MS;

        topic = formatRelativePeerPresenceLabel(latestActivityAt, locale, isOnline);
      }
    }
  }

  const summary = {
    id: roomId,
    name: roomName,
    topic,
    languagePair,
    avatarUrl: relatedProfile.avatar_url ?? chatRow.avatar_url ?? undefined,
    unreadCount: 0,
    myLanguage: viewerParticipant?.preferred_language_snapshot
      ? getLocaleLabel(viewerParticipant.preferred_language_snapshot)
      : undefined,
    peerLanguage: otherParticipant?.preferred_language_snapshot
      ? getLocaleLabel(otherParticipant.preferred_language_snapshot)
      : undefined
    ,
    peerProfile
  } satisfies ChatRoomSummary;

  console.log("getChatRoomSummary resolved", {
    roomId,
    userId,
    roomName: summary.name,
    topic: summary.topic,
    avatarUrl: summary.avatarUrl,
    otherParticipant,
    otherProfile: relatedProfile
  });

  return summary;
}

export async function findOrCreateDirectChat(
  client: any,
  currentUserId: string,
  otherUserId: string
) {
  if (!currentUserId || !otherUserId) {
    throw new Error("A valid current user and target user are required.");
  }

  if (currentUserId === otherUserId) {
    throw new Error("You cannot create a direct chat with yourself.");
  }

  const relationship = await getFriendshipBetweenUsers(currentUserId, otherUserId);

  if (!relationship || relationship.status !== "accepted") {
    throw new Error("You can only open chats with accepted friends.");
  }

  if (await hasUserBlocked(currentUserId, otherUserId)) {
    throw new Error("This chat is no longer available.");
  }

  const admin = createSupabaseAdminClient();
  const { data: profileRows } = (await admin
    .from("profiles")
    .select("id, email, display_name, preferred_language, avatar_url")
    .in("id", [currentUserId, otherUserId])) as {
    data: Array<
      Pick<ProfileRow, "id" | "email" | "display_name" | "preferred_language" | "avatar_url">
    > | null;
    error: { message?: string } | null;
  };
  const profileMap = new Map((profileRows ?? []).map((row) => [row.id, row]));

  const { data: currentMemberships, error: currentMembershipsError } = (await client
    .from("chat_participants")
    .select("chat_id")
    .eq("user_id", currentUserId)) as {
    data: Array<Pick<ChatParticipantRow, "chat_id">> | null;
    error: { message?: string } | null;
  };

  if (currentMembershipsError) {
    throw new Error(currentMembershipsError.message ?? "We couldn't load your chats right now.");
  }

  const existingChatIds = currentMemberships?.map((row) => row.chat_id) ?? [];

  if (existingChatIds.length > 0) {
    const { data: directChatRows, error: directChatError } = (await client
      .from("chats")
      .select("id, chat_type")
      .in("id", existingChatIds)
      .eq("chat_type", "direct")) as {
      data: Array<Pick<ChatRow, "id" | "chat_type">> | null;
      error: { message?: string } | null;
    };

    if (directChatError) {
      throw new Error(directChatError.message ?? "We couldn't verify your direct chats right now.");
    }

    const directChatIds = (directChatRows ?? []).map((row) => row.id);

    if (directChatIds.length > 0) {
      const { data: participantRows, error: participantRowsError } = (await admin
        .from("chat_participants")
        .select("chat_id, user_id")
        .in("chat_id", directChatIds)) as {
        data: ChatParticipantRow[] | null;
        error: { message?: string } | null;
      };

      if (participantRowsError) {
        throw new Error(
          participantRowsError.message ?? "We couldn't inspect your direct chat participants right now."
        );
      }

      const participantsByChat = new Map<string, Set<string>>();

      for (const row of participantRows ?? []) {
        const chatParticipants = participantsByChat.get(row.chat_id) ?? new Set<string>();
        chatParticipants.add(row.user_id);
        participantsByChat.set(row.chat_id, chatParticipants);
      }

      for (const [chatId, participantSet] of participantsByChat.entries()) {
        if (
          participantSet.size === 2 &&
          participantSet.has(currentUserId) &&
          participantSet.has(otherUserId)
        ) {
          await ensureChatRoomSummaries(chatId);
          return chatId;
        }
      }
    }
  }

  const { data: newChatRow, error: newChatError } = (await admin
    .from("chats")
    .insert({
      chat_type: "direct",
      created_by: currentUserId
    })
    .select("id")
    .single()) as {
    data: Pick<ChatRow, "id"> | null;
    error: { message?: string } | null;
  };

  if (newChatError || !newChatRow) {
    throw new Error(newChatError?.message ?? "We couldn't create a new direct chat.");
  }

  const { error: participantInsertError } = await admin.from("chat_participants").insert([
    {
      chat_id: newChatRow.id,
      user_id: currentUserId,
      preferred_language_snapshot: profileMap.get(currentUserId)?.preferred_language ?? null,
      display_name_snapshot: profileMap.get(currentUserId)?.display_name ?? null,
      email_snapshot: profileMap.get(currentUserId)?.email ?? null,
      avatar_url_snapshot: profileMap.get(currentUserId)?.avatar_url ?? null
    },
    {
      chat_id: newChatRow.id,
      user_id: otherUserId,
      preferred_language_snapshot: profileMap.get(otherUserId)?.preferred_language ?? null,
      display_name_snapshot: profileMap.get(otherUserId)?.display_name ?? null,
      email_snapshot: profileMap.get(otherUserId)?.email ?? null,
      avatar_url_snapshot: profileMap.get(otherUserId)?.avatar_url ?? null
    }
  ]);

  if (participantInsertError) {
    throw new Error(
      participantInsertError.message ?? "We created the chat but couldn't add the participants."
    );
  }

  await ensureChatRoomSummaries(newChatRow.id);

  return newChatRow.id;
}

