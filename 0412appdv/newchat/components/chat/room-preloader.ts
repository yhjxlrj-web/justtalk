"use client";

import { formatChatTimestamp } from "@/lib/messages/format";
import {
  INITIAL_ROOM_MESSAGE_LIMIT,
  PRELOAD_ROOM_LIMIT,
  UNREAD_CONTEXT_MESSAGE_LIMIT
} from "@/lib/chats/room-loading";
import { setCachedRoomMessages } from "@/components/chat/room-message-cache";
import {
  getCachedRoomEntrySnapshot,
  getOrCreateRoomInflightRequest,
  getRecentChatRooms,
  setCachedRoomEntrySnapshot
} from "@/components/chat/room-entry-cache";
import type { ChatMessage } from "@/types/chat";
import type { ChatRoomPreview } from "@/types/home";

type BrowserSupabaseClient = any;

type PreloadMessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  original_text: string;
  original_language: string;
  created_at: string;
  client_message_id?: string | null;
  message_kind?: "text" | "image" | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_content_type?: string | null;
};

type PreloadTranslationRow = {
  message_id: string;
  target_language: string;
  translated_text: string;
};

type PreloadParticipantRow = {
  user_id: string;
  last_seen_at: string | null;
};

const roomRoutePrefetches = new Set<string>();
const ROOM_PRELOAD_STAGGER_MS = 140;
const UNREAD_ROOM_PRELOAD_LIMIT = 5;
const UNREAD_ROOM_PRELOAD_STAGGER_MS = 80;
const PENDING_TRANSLATION_PLACEHOLDER = "Translating...";

function getRoomPrewarmInflightKey(roomId: string, viewerId: string) {
  return `prewarm-room:${roomId}:${viewerId}`;
}

function waitForSequentialPreloadTurn(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftTime - rightTime;
  });
}

function applyOutgoingReadStatuses(
  messages: ChatMessage[],
  otherUserLastSeenAt: string | null
): ChatMessage[] {
  const orderedMessages = sortMessages(messages);
  const outgoingMessages = orderedMessages.filter((message) => message.direction === "outgoing");
  const readOutgoingMessages = outgoingMessages.filter(
    (message) =>
      otherUserLastSeenAt &&
      message.createdAt &&
      new Date(message.createdAt).getTime() <= new Date(otherUserLastSeenAt).getTime()
  );
  const lastReadMessageId =
    readOutgoingMessages.length > 0
      ? readOutgoingMessages[readOutgoingMessages.length - 1].id
      : null;
  const outgoingOrder = new Map(outgoingMessages.map((message, index) => [message.id, index]));
  const lastReadOrder =
    lastReadMessageId !== null ? outgoingOrder.get(lastReadMessageId) ?? -1 : -1;

  return orderedMessages.map((message) => {
    if (message.direction !== "outgoing") {
      return message.readStatus === null ? message : { ...message, readStatus: null };
    }

    const currentOutgoingOrder = outgoingOrder.get(message.id);
    let readStatus: ChatMessage["readStatus"] = null;

    if (message.id === lastReadMessageId) {
      readStatus = "read";
    } else if (currentOutgoingOrder !== undefined && currentOutgoingOrder > lastReadOrder) {
      readStatus = "unread";
    }

    return {
      ...message,
      deliveryStatus: "sent",
      readStatus
    };
  });
}

function buildPriorityRoomList(chats: ChatRoomPreview[]) {
  const nonUnreadRooms = chats.filter((chat) => (chat.unreadCount ?? 0) === 0);
  const recentRooms = getRecentChatRooms()
    .map((roomId) => chats.find((chat) => chat.roomId === roomId))
    .filter((chat): chat is ChatRoomPreview => !!chat && (chat.unreadCount ?? 0) === 0);
  const prioritized = [...nonUnreadRooms, ...recentRooms];
  const unique = new Map<string, ChatRoomPreview>();

  for (const chat of prioritized) {
    if (!unique.has(chat.roomId)) {
      unique.set(chat.roomId, chat);
    }
  }

  return Array.from(unique.values()).slice(0, PRELOAD_ROOM_LIMIT);
}

function buildUnreadPriorityRoomList(chats: ChatRoomPreview[]) {
  return chats.filter((chat) => (chat.unreadCount ?? 0) > 0).slice(0, UNREAD_ROOM_PRELOAD_LIMIT);
}

function prefetchRoomRoute(params: {
  roomId: string;
  router: { prefetch: (href: string) => void };
}) {
  const { roomId, router } = params;

  if (roomRoutePrefetches.has(roomId)) {
    return;
  }

  router.prefetch(`/chat/${roomId}`);
  roomRoutePrefetches.add(roomId);
}

export function prewarmChatRoom(params: {
  roomId: string;
  router?: { prefetch: (href: string) => void };
  supabase: BrowserSupabaseClient;
  viewerId: string;
}) {
  const { roomId, router, supabase, viewerId } = params;

  if (router) {
    prefetchRoomRoute({
      roomId,
      router
    });
  }

  if (getCachedRoomEntrySnapshot(roomId)) {
    return Promise.resolve();
  }

  const inflightKey = getRoomPrewarmInflightKey(roomId, viewerId);
  return getOrCreateRoomInflightRequest(inflightKey, () =>
    preloadRoom({
      roomId,
      supabase,
      viewerId
    })
  );
}

async function preloadRoom(params: {
  roomId: string;
  supabase: BrowserSupabaseClient;
  viewerId: string;
}) {
  const { roomId, supabase, viewerId } = params;

  if (getCachedRoomEntrySnapshot(roomId)) {
    return;
  }

  const { data: participants, error: participantsError } = await supabase
    .from("chat_participants")
    .select("user_id, last_seen_at")
    .eq("chat_id", roomId);

  if (participantsError) {
    console.error("room preload participants failed", { roomId, participantsError });
    return;
  }

  const participantRows = (participants ?? []) as PreloadParticipantRow[];
  const viewerParticipant =
    participantRows.find((participant) => participant.user_id === viewerId) ?? null;
  const otherParticipant =
    participantRows.find((participant) => participant.user_id !== viewerId) ?? null;
  const viewerLastSeenAt = viewerParticipant?.last_seen_at ?? null;
  const otherUserLastSeenAt = otherParticipant?.last_seen_at ?? null;

  const { data: fetchedMessages, error: messagesError } = await supabase
    .from("messages")
    .select(
      "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
    )
    .eq("chat_id", roomId)
    .order("created_at", { ascending: false })
    .limit(INITIAL_ROOM_MESSAGE_LIMIT);

  if (messagesError) {
    console.error("room preload messages failed", { roomId, messagesError });
    return;
  }

  const recentRows = [...((fetchedMessages ?? []) as PreloadMessageRow[])].reverse();

  const baseMappedMessages = recentRows.map((message) => {
    const outgoing = message.sender_id === viewerId;
    const incomingDisplayText =
      message.message_kind === "image"
        ? message.original_text
        : PENDING_TRANSLATION_PLACEHOLDER;
    const displayText = outgoing ? message.original_text : incomingDisplayText;

    return {
      id: message.id,
      clientId: message.client_message_id ?? undefined,
      chatRoomId: message.chat_id,
      senderId: message.sender_id,
      direction: outgoing ? "outgoing" : "incoming",
      messageType: (message.message_kind as "text" | "image") ?? "text",
      originalText: message.original_text,
      displayText,
      body: displayText,
      originalBody: outgoing ? undefined : message.original_text,
      senderLanguage: message.original_language,
      targetLanguage: message.original_language,
      language: message.original_language,
      timestamp: formatChatTimestamp(message.created_at),
      createdAt: message.created_at,
      imageUrl: message.attachment_url ?? undefined,
      attachmentName: message.attachment_name ?? undefined,
      attachmentContentType: message.attachment_content_type ?? undefined,
      canRetry: outgoing,
      deliveryStatus: outgoing ? ("sent" as const) : undefined,
      readStatus: null,
      reactions: []
    } satisfies ChatMessage;
  });

  const baseSnapshot = {
    initialScrollTargetMessageId: null,
    messages: baseMappedMessages,
    hasOlderMessages: false,
    otherUserLastSeenAt,
    preloadedAt: Date.now()
  };

  setCachedRoomMessages(roomId, baseMappedMessages);
  setCachedRoomEntrySnapshot(roomId, baseSnapshot);

  console.log("room prewarm base cached", {
    roomId,
    viewerId,
    baseMessageCount: baseMappedMessages.length
  });

  const { data: firstUnreadRows, error: firstUnreadError } = await supabase
    .from("messages")
    .select(
      "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
    )
    .eq("chat_id", roomId)
    .neq("sender_id", viewerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .gte("created_at", viewerLastSeenAt ?? "1970-01-01T00:00:00.000Z");

  if (firstUnreadError) {
    console.error("room preload first unread lookup failed", { roomId, firstUnreadError });
  }

  const firstUnreadRow = ((firstUnreadRows ?? []) as PreloadMessageRow[])[0] ?? null;
  const needsUnreadExpansion =
    !!firstUnreadRow && !recentRows.some((message) => message.id === firstUnreadRow.id);

  let orderedRows = recentRows;

  if (needsUnreadExpansion) {
    const { data: unreadContextRows, error: unreadContextError } = await supabase
      .from("messages")
      .select(
        "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
      )
      .eq("chat_id", roomId)
      .gte("created_at", firstUnreadRow.created_at)
      .order("created_at", { ascending: true })
      .limit(UNREAD_CONTEXT_MESSAGE_LIMIT);

    if (unreadContextError) {
      console.error("room preload unread context failed", { roomId, unreadContextError });
    } else if (unreadContextRows?.length) {
      const mergedById = new Map<string, PreloadMessageRow>();

      for (const row of unreadContextRows as PreloadMessageRow[]) {
        mergedById.set(row.id, row);
      }

      for (const row of recentRows) {
        mergedById.set(row.id, row);
      }

      orderedRows = [...mergedById.values()].sort(
        (left, right) =>
          new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
      );
    }
  }

  const firstUnreadMessageId = firstUnreadRow?.id ?? null;

  if (orderedRows.length === 0) {
    setCachedRoomMessages(roomId, []);
    setCachedRoomEntrySnapshot(roomId, {
      initialScrollTargetMessageId: null,
      messages: [],
      hasOlderMessages: false,
      otherUserLastSeenAt,
      preloadedAt: Date.now()
    });
    return;
  }

  const messageIds = orderedRows.map((message) => message.id);
  const { data: translations, error: translationsError } = await supabase
    .from("message_translations")
    .select("message_id, target_language, translated_text")
    .eq("target_user_id", viewerId)
    .in("message_id", messageIds);

  if (translationsError) {
    console.error("room preload translations failed", { roomId, translationsError });
  }

  const translationMap = new Map(
    ((translations ?? []) as PreloadTranslationRow[]).map((translation) => [
      translation.message_id,
      translation
    ])
  );

  const mappedMessages = applyOutgoingReadStatuses(
    orderedRows.map((message) => {
      const outgoing = message.sender_id === viewerId;
      const translation = translationMap.get(message.id);
      const displayText = outgoing
        ? message.original_text
        : translation?.translated_text ?? message.original_text;

      return {
        id: message.id,
        clientId: message.client_message_id ?? undefined,
        chatRoomId: message.chat_id,
        senderId: message.sender_id,
        direction: outgoing ? "outgoing" : "incoming",
        messageType: (message.message_kind as "text" | "image") ?? "text",
        originalText: message.original_text,
        displayText,
        body: displayText,
        originalBody: outgoing ? undefined : message.original_text,
        senderLanguage: message.original_language,
        targetLanguage: outgoing
          ? message.original_language
          : translation?.target_language ?? message.original_language,
        language: outgoing
          ? message.original_language
          : translation?.target_language ?? message.original_language,
        timestamp: formatChatTimestamp(message.created_at),
        createdAt: message.created_at,
        imageUrl: message.attachment_url ?? undefined,
        attachmentName: message.attachment_name ?? undefined,
        attachmentContentType: message.attachment_content_type ?? undefined,
        canRetry: false,
        deliveryStatus: outgoing ? ("sent" as const) : undefined,
        readStatus: null,
        reactions: []
      } satisfies ChatMessage;
    }),
    otherUserLastSeenAt
  );

  const oldestLoadedAt = orderedRows[0]?.created_at ?? null;
  let hasOlderMessages = false;

  if (oldestLoadedAt) {
    const { data: olderRows, error: olderRowsError } = await supabase
      .from("messages")
      .select("id")
      .eq("chat_id", roomId)
      .lt("created_at", oldestLoadedAt)
      .order("created_at", { ascending: false })
      .limit(1);

    if (olderRowsError) {
      console.error("room preload older message probe failed", { roomId, olderRowsError });
    } else {
      hasOlderMessages = (olderRows?.length ?? 0) > 0;
    }
  }

  setCachedRoomMessages(roomId, mappedMessages);
  setCachedRoomEntrySnapshot(roomId, {
    initialScrollTargetMessageId: firstUnreadMessageId,
    messages: mappedMessages,
    hasOlderMessages,
    otherUserLastSeenAt,
    preloadedAt: Date.now()
  });
}

function preloadRoomQueue(params: {
  chats: ChatRoomPreview[];
  router: { prefetch: (href: string) => void };
  roomSelector: (chats: ChatRoomPreview[]) => ChatRoomPreview[];
  staggerMs: number;
  supabase: BrowserSupabaseClient;
  shouldContinue?: () => boolean;
  viewerId: string;
}) {
  const { chats, roomSelector, router, shouldContinue, staggerMs, supabase, viewerId } = params;
  const prioritizedRooms = roomSelector(chats);

  void (async () => {
    for (const [index, chat] of prioritizedRooms.entries()) {
      if (shouldContinue && !shouldContinue()) {
        break;
      }

      if (index > 0) {
        await waitForSequentialPreloadTurn(staggerMs);

        if (shouldContinue && !shouldContinue()) {
          break;
        }
      }

      prefetchRoomRoute({
        roomId: chat.roomId,
        router
      });
      await prewarmChatRoom({
        roomId: chat.roomId,
        supabase,
        viewerId
      });
    }
  })();
}

export function preloadUnreadChatRooms(params: {
  chats: ChatRoomPreview[];
  router: { prefetch: (href: string) => void };
  supabase: BrowserSupabaseClient;
  shouldContinue?: () => boolean;
  viewerId: string;
}) {
  preloadRoomQueue({
    ...params,
    roomSelector: buildUnreadPriorityRoomList,
    staggerMs: UNREAD_ROOM_PRELOAD_STAGGER_MS
  });
}

export function preloadTopChatRooms(params: {
  chats: ChatRoomPreview[];
  router: { prefetch: (href: string) => void };
  supabase: BrowserSupabaseClient;
  shouldContinue?: () => boolean;
  viewerId: string;
}) {
  preloadRoomQueue({
    ...params,
    roomSelector: buildPriorityRoomList,
    staggerMs: ROOM_PRELOAD_STAGGER_MS
  });
}
