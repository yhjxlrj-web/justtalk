"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChatRoom } from "@/components/chat/chat-room";
import {
  getCachedChatPreviews,
  mergeChatPreviews,
  patchCachedChatPreview,
  setCachedChatPreviews
} from "@/components/home/chat-preview-cache";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import {
  clearCachedRoomEntrySnapshot,
  getOrCreateRoomInflightRequest,
  getCachedRoomEntrySnapshot,
  getRoomInflightRequest,
  recordRecentChatRoom,
  setCachedRoomEntrySnapshot
} from "@/components/chat/room-entry-cache";
import {
  clearCachedRoomMessages,
  getCachedRoomMessages,
  setCachedRoomMessages
} from "@/components/chat/room-message-cache";
import { initialSendMessageFormState } from "@/lib/messages/action-state";
import { sendMessageAction } from "@/lib/messages/actions";
import { getChatRoomSummaryAction } from "@/lib/chats/actions";
import { isChatMessageTooLong } from "@/lib/messages/constants";
import {
  INITIAL_ROOM_MESSAGE_LIMIT,
  OLDER_MESSAGES_PAGE_SIZE,
  UNREAD_CONTEXT_MESSAGE_LIMIT
} from "@/lib/chats/room-loading";
import { formatChatTimestamp } from "@/lib/messages/format";
import { logRealtime } from "@/lib/logging/realtime-log";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatMessage, ChatReaction, ChatRoomSummary } from "@/types/chat";

type RealtimeMessageRow = {
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

type RealtimeTranslationRow = {
  id: string;
  message_id: string;
  target_user_id: string;
  target_language: string;
  translated_text: string;
  created_at: string;
};

type RealtimeParticipantRow = {
  user_id: string;
  last_seen_at: string | null;
};

type RealtimeReactionRow = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type RealtimeSummaryUpdateRow = {
  room_id: string;
  user_id: string;
  last_message_id?: string | null;
  last_message_preview?: string | null;
  last_message_created_at?: string | null;
};

type ChatRoomSummaryCacheRow = {
  room_id: string;
  peer_user_id?: string | null;
  peer_display_name_snapshot?: string | null;
  peer_avatar_snapshot?: string | null;
  last_message_id?: string | null;
  last_message_preview?: string | null;
  last_message_created_at?: string | null;
  unread_count?: number | null;
  updated_at?: string | null;
};

type RoomMessageBatch = {
  firstUnreadMessageId: string | null;
  hasOlderMessages: boolean;
  messages: ChatMessage[];
  otherUserLastSeenAt: string | null;
};

type RoomBaseMessageBatch = {
  messages: ChatMessage[];
  otherUserLastSeenAt: string | null;
  viewerLastSeenAt: string | null;
};

const REACTION_ORDER = ["?ㅿ툘", "?몟", "?ㄳ", "?삲", "?몞", "?솋"] as const;

const MESSAGE_STATUS_PATCH_BUFFER_MS = 360;
const HOME_CACHE_PREWARM_SUMMARY_LIMIT = 12;
const ROOM_ENTRY_SUMMARY_PREWARM_DELAY_MS = 900;
const PREWARM_HANDOFF_WAIT_MS = 120;
const PENDING_TRANSLATION_PLACEHOLDER = "…";

function getRoomEntryKey(roomId: string, viewerId: string) {
  return `${roomId}:${viewerId}`;
}

function getRoomInflightKey(stage: string, roomId: string, viewerId: string) {
  return `${stage}:${roomId}:${viewerId}`;
}

function waitForHandoff(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fetchInitialRoomMessageBatchWithDedupe(params: {
  roomId: string;
  supabase: any;
  viewerId: string;
}) {
  const key = getRoomInflightKey("room-initial-full", params.roomId, params.viewerId);
  return getOrCreateRoomInflightRequest<RoomMessageBatch>(key, () =>
    fetchInitialRoomMessageBatch(params)
  );
}

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftTime - rightTime;
  });
}

type MessageDeliveryStatus = "sending" | "sent" | "failed";
type MessageStatusEntry = {
  deliveryStatus: MessageDeliveryStatus;
  readStatus: "read" | "unread" | null;
};
type MessageStatusMap = Record<string, MessageStatusEntry>;
type MessageStatusPatchMap = Record<string, Partial<MessageStatusEntry>>;

function getMessageStatusKey(message: Pick<ChatMessage, "id" | "clientId">) {
  return message.clientId ?? message.id;
}

function resolveMessageDeliveryStatus(
  message: Pick<ChatMessage, "direction" | "deliveryStatus">,
  existingStatus?: MessageDeliveryStatus
): MessageDeliveryStatus {
  if (existingStatus) {
    return existingStatus;
  }

  if (message.deliveryStatus) {
    return message.deliveryStatus;
  }

  return message.direction === "outgoing" ? "sent" : "sent";
}

function buildMessageStatusMap(params: {
  messages: ChatMessage[];
  otherUserLastSeenAt: string | null;
  previousStatusMap?: MessageStatusMap;
}): MessageStatusMap {
  const { messages, otherUserLastSeenAt, previousStatusMap } = params;
  const orderedMessages = sortMessages(messages);
  const nextStatusMap: MessageStatusMap = {};
  const outgoingStatusIndex = new Map<string, number>();
  const readableOutgoingKeys: string[] = [];
  const otherUserLastSeenAtTime = otherUserLastSeenAt ? new Date(otherUserLastSeenAt).getTime() : null;
  let lastReadMessageKey: string | null = null;

  for (const message of orderedMessages) {
    const messageStatusKey = getMessageStatusKey(message);
    const previousStatus = previousStatusMap?.[messageStatusKey];
    const deliveryStatus = resolveMessageDeliveryStatus(message, previousStatus?.deliveryStatus);
    nextStatusMap[messageStatusKey] = {
      deliveryStatus,
      readStatus: null
    };

    if (message.direction !== "outgoing" || deliveryStatus === "failed" || deliveryStatus === "sending") {
      continue;
    }

    outgoingStatusIndex.set(messageStatusKey, readableOutgoingKeys.length);
    readableOutgoingKeys.push(messageStatusKey);

    if (
      otherUserLastSeenAtTime !== null &&
      message.createdAt &&
      new Date(message.createdAt).getTime() <= otherUserLastSeenAtTime
    ) {
      lastReadMessageKey = messageStatusKey;
    }
  }

  const lastReadOrder =
    lastReadMessageKey !== null ? outgoingStatusIndex.get(lastReadMessageKey) ?? -1 : -1;

  for (const messageStatusKey of readableOutgoingKeys) {
    const status = nextStatusMap[messageStatusKey];
    const currentOrder = outgoingStatusIndex.get(messageStatusKey);

    if (!status || currentOrder === undefined) {
      continue;
    }

    if (messageStatusKey === lastReadMessageKey) {
      status.readStatus = "read";
      continue;
    }

    if (currentOrder > lastReadOrder) {
      status.readStatus = "unread";
    }
  }

  return nextStatusMap;
}

function areMessageStatusMapsEqual(left: MessageStatusMap, right: MessageStatusMap) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    const leftEntry = left[key];
    const rightEntry = right[key];

    if (!rightEntry) {
      return false;
    }

    if (
      leftEntry.deliveryStatus !== rightEntry.deliveryStatus ||
      leftEntry.readStatus !== rightEntry.readStatus
    ) {
      return false;
    }
  }

  return true;
}

function buildReactionSummaries(
  reactionRows: RealtimeReactionRow[],
  viewerId: string
): ChatReaction[] {
  const counts = new Map<string, ChatReaction>();

  for (const row of reactionRows) {
    const existing = counts.get(row.emoji);

    if (existing) {
      existing.count += 1;
      existing.reactedByViewer = existing.reactedByViewer || row.user_id === viewerId;
      continue;
    }

    counts.set(row.emoji, {
      emoji: row.emoji,
      count: 1,
      reactedByViewer: row.user_id === viewerId
    });
  }

  return Array.from(counts.values()).sort((left, right) => {
    const leftIndex = REACTION_ORDER.indexOf(left.emoji as (typeof REACTION_ORDER)[number]);
    const rightIndex = REACTION_ORDER.indexOf(right.emoji as (typeof REACTION_ORDER)[number]);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.emoji.localeCompare(right.emoji);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function applyReactionSummaries(
  messages: ChatMessage[],
  reactionsByMessageId: Map<string, RealtimeReactionRow[]>,
  viewerId: string
) {
  return messages.map((message) =>
    reactionsByMessageId.has(message.id)
      ? {
          ...message,
          reactions: buildReactionSummaries(reactionsByMessageId.get(message.id) ?? [], viewerId)
        }
      : message
  );
}

function mapRealtimeMessages(params: {
  fetchedMessages: RealtimeMessageRow[];
  translationsByMessageId: Map<string, RealtimeTranslationRow>;
  reactionsByMessageId: Map<string, RealtimeReactionRow[]>;
  viewerId: string;
}): ChatMessage[] {
  const {
    fetchedMessages,
    translationsByMessageId,
    reactionsByMessageId,
    viewerId
  } = params;

  const baseMessages = fetchedMessages.map((message) => {
    const outgoing = message.sender_id === viewerId;
    const translation = translationsByMessageId.get(message.id);
    const incomingDisplayText =
      translation?.translated_text && translation.translated_text.trim().length > 0
        ? translation.translated_text
        : PENDING_TRANSLATION_PLACEHOLDER;

    return {
      id: message.id,
      clientId: message.client_message_id ?? undefined,
      chatRoomId: message.chat_id,
      senderId: message.sender_id,
      direction: outgoing ? "outgoing" : "incoming",
      messageType: (message.message_kind as "text" | "image") ?? "text",
      originalText: message.original_text,
      displayText: outgoing ? message.original_text : incomingDisplayText,
      body: outgoing ? message.original_text : incomingDisplayText,
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
      canRetry: outgoing,
      reactions: buildReactionSummaries(reactionsByMessageId.get(message.id) ?? [], viewerId)
    } satisfies ChatMessage;
  });

  return sortMessages(baseMessages);
}

function mergeServerMessages(params: {
  current: ChatMessage[];
  serverMessages: ChatMessage[];
  currentStatusMap: MessageStatusMap;
}) {
  const { current, serverMessages, currentStatusMap } = params;
  const serverIds = new Set(serverMessages.map((message) => message.id));
  const serverClientIds = new Set(
    serverMessages.map((message) => message.clientId).filter(Boolean) as string[]
  );
  const unsyncedLocalMessages = current.filter(
    (message) =>
      (() => {
        const status = currentStatusMap[getMessageStatusKey(message)];
        return status?.deliveryStatus === "sending" || status?.deliveryStatus === "failed";
      })() &&
      !serverIds.has(message.id) &&
      (!message.clientId || !serverClientIds.has(message.clientId))
  );

  return sortMessages([...serverMessages, ...unsyncedLocalMessages]);
}

async function hydrateFetchedMessages(params: {
  fetchedMessages: RealtimeMessageRow[];
  supabase: any;
  viewerId: string;
}) {
  const { fetchedMessages, supabase, viewerId } = params;

  if (fetchedMessages.length === 0) {
    return [] as ChatMessage[];
  }

  const messageIds = fetchedMessages.map((message) => message.id);
  let translationsByMessageId = new Map<string, RealtimeTranslationRow>();
  let reactionsByMessageId = new Map<string, RealtimeReactionRow[]>();

  const [{ data: fetchedTranslations, error: translationsError }, { data: fetchedReactions, error: reactionsError }] =
    await Promise.all([
      supabase
        .from("message_translations")
        .select("id, message_id, target_user_id, target_language, translated_text, created_at")
        .in("message_id", messageIds)
        .eq("target_user_id", viewerId),
      supabase
        .from("message_reactions")
        .select("id, message_id, user_id, emoji, created_at")
        .in("message_id", messageIds)
    ]);

  if (translationsError) {
    console.error("Failed to load translations:", translationsError);
  } else {
    translationsByMessageId = new Map(
      ((fetchedTranslations ?? []) as RealtimeTranslationRow[]).map((translation) => [
        translation.message_id,
        translation
      ])
    );
  }

  if (reactionsError) {
    console.error("Failed to load reactions:", reactionsError);
  } else {
    for (const reaction of (fetchedReactions ?? []) as RealtimeReactionRow[]) {
      const reactionRows = reactionsByMessageId.get(reaction.message_id) ?? [];
      reactionRows.push(reaction);
      reactionsByMessageId.set(reaction.message_id, reactionRows);
    }
  }

  return mapRealtimeMessages({
    fetchedMessages,
    translationsByMessageId,
    reactionsByMessageId,
    viewerId
  });
}

function fetchInitialRoomBaseMessageBatchWithDedupe(params: {
  roomId: string;
  supabase: any;
  viewerId: string;
}) {
  const key = getRoomInflightKey("room-initial-base", params.roomId, params.viewerId);
  return getOrCreateRoomInflightRequest<RoomBaseMessageBatch>(key, () =>
    fetchInitialRoomBaseMessageBatch(params)
  );
}

async function fetchInitialRoomBaseMessageBatch(params: {
  roomId: string;
  supabase: any;
  viewerId: string;
}): Promise<RoomBaseMessageBatch> {
  const { roomId, supabase, viewerId } = params;
  const [{ data: participants, error: participantsError }, { data: fetchedRecentMessages, error: messagesError }] =
    await Promise.all([
      supabase.from("chat_participants").select("user_id, last_seen_at").eq("chat_id", roomId),
      supabase
        .from("messages")
        .select(
          "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
        )
        .eq("chat_id", roomId)
        .order("created_at", { ascending: false })
        .limit(INITIAL_ROOM_MESSAGE_LIMIT)
    ]);

  if (participantsError) {
    throw participantsError;
  }

  if (messagesError) {
    throw messagesError;
  }

  const participantRows = (participants ?? []) as RealtimeParticipantRow[];
  const viewerParticipant =
    participantRows.find((participant) => participant.user_id === viewerId) ?? null;
  const otherParticipant =
    participantRows.find((participant) => participant.user_id !== viewerId) ?? null;
  const viewerLastSeenAt = viewerParticipant?.last_seen_at ?? null;
  const otherUserLastSeenAt = otherParticipant?.last_seen_at ?? null;

  const orderedRows = [...((fetchedRecentMessages ?? []) as RealtimeMessageRow[])].reverse();
  const messages = sortMessages(
    orderedRows.map((message) => {
      const outgoing = message.sender_id === viewerId;
      const displayText =
        outgoing || message.message_kind === "image"
          ? message.original_text
          : PENDING_TRANSLATION_PLACEHOLDER;

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
        reactions: []
      } satisfies ChatMessage;
    })
  );

  return {
    messages,
    otherUserLastSeenAt,
    viewerLastSeenAt
  };
}

async function fetchInitialRoomMessageBatch(params: {
  roomId: string;
  supabase: any;
  viewerId: string;
}): Promise<RoomMessageBatch> {
  const { roomId, supabase, viewerId } = params;

  const { data: participants, error: participantsError } = await supabase
    .from("chat_participants")
    .select("user_id, last_seen_at")
    .eq("chat_id", roomId);

  if (participantsError) {
    throw participantsError;
  }

  const participantRows = (participants ?? []) as RealtimeParticipantRow[];
  const viewerParticipant =
    participantRows.find((participant) => participant.user_id === viewerId) ?? null;
  const otherParticipant =
    participantRows.find((participant) => participant.user_id !== viewerId) ?? null;
  const viewerLastSeenAt = viewerParticipant?.last_seen_at ?? null;
  const otherUserLastSeenAt = otherParticipant?.last_seen_at ?? null;

  const { data: fetchedRecentMessages, error: messagesError } = await supabase
    .from("messages")
    .select(
      "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
    )
    .eq("chat_id", roomId)
    .order("created_at", { ascending: false })
    .limit(INITIAL_ROOM_MESSAGE_LIMIT);

  if (messagesError) {
    throw messagesError;
  }

  const recentMessages = [...((fetchedRecentMessages ?? []) as RealtimeMessageRow[])].reverse();

  const firstUnreadBaseQuery = supabase
    .from("messages")
    .select(
      "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
    )
    .eq("chat_id", roomId)
    .neq("sender_id", viewerId)
    .order("created_at", { ascending: true })
    .limit(1);

  const { data: firstUnreadRows, error: firstUnreadError } = viewerLastSeenAt
    ? await firstUnreadBaseQuery.gt("created_at", viewerLastSeenAt)
    : await firstUnreadBaseQuery;

  if (firstUnreadError) {
    throw firstUnreadError;
  }

  const firstUnreadRow = ((firstUnreadRows ?? []) as RealtimeMessageRow[])[0] ?? null;
  const needsUnreadExpansion =
    !!firstUnreadRow && !recentMessages.some((message) => message.id === firstUnreadRow.id);

  let orderedRows = recentMessages;

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
      throw unreadContextError;
    }

    const mergedById = new Map<string, RealtimeMessageRow>();

    for (const row of (unreadContextRows ?? []) as RealtimeMessageRow[]) {
      mergedById.set(row.id, row);
    }

    for (const row of recentMessages) {
      mergedById.set(row.id, row);
    }

    orderedRows = [...mergedById.values()].sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    );
  }

  const messages = await hydrateFetchedMessages({
    fetchedMessages: orderedRows,
    supabase,
    viewerId
  });

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
      throw olderRowsError;
    }

    hasOlderMessages = (olderRows?.length ?? 0) > 0;
  }

  return {
    firstUnreadMessageId: firstUnreadRow?.id ?? null,
    hasOlderMessages,
    messages,
    otherUserLastSeenAt
  };
}

async function fetchOlderRoomMessageBatch(params: {
  beforeCreatedAt: string;
  roomId: string;
  supabase: any;
  viewerId: string;
}) {
  const { beforeCreatedAt, roomId, supabase, viewerId } = params;

  const { data: fetchedOlderMessages, error: olderMessagesError } = await supabase
    .from("messages")
    .select(
      "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
    )
    .eq("chat_id", roomId)
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: false })
    .limit(OLDER_MESSAGES_PAGE_SIZE);

  if (olderMessagesError) {
    throw olderMessagesError;
  }

  const orderedRows = [...((fetchedOlderMessages ?? []) as RealtimeMessageRow[])].reverse();

  if (orderedRows.length === 0) {
    return {
      hasOlderMessages: false,
      messages: [] as ChatMessage[]
    };
  }

  const messages = await hydrateFetchedMessages({
    fetchedMessages: orderedRows,
    supabase,
    viewerId
  });

  const oldestLoadedAt = orderedRows[0]?.created_at ?? null;
  let hasOlderMessages = false;

  if (oldestLoadedAt) {
    const { data: olderRows, error: olderProbeError } = await supabase
      .from("messages")
      .select("id")
      .eq("chat_id", roomId)
      .lt("created_at", oldestLoadedAt)
      .order("created_at", { ascending: false })
      .limit(1);

    if (olderProbeError) {
      throw olderProbeError;
    }

    hasOlderMessages = (olderRows?.length ?? 0) > 0;
  }

  return {
    hasOlderMessages,
    messages
  };
}

function mapRealtimeRowToMessage(params: {
  row: RealtimeMessageRow;
  viewerId: string;
  translatedText?: string | null;
  translatedLanguage?: string | null;
}): ChatMessage {
  const { row, viewerId, translatedText, translatedLanguage } = params;
  const isOutgoing = row.sender_id === viewerId;
  const isImageMessage = row.message_kind === "image";
  const incomingDisplayText =
    translatedText && translatedText.trim().length > 0
      ? translatedText
      : PENDING_TRANSLATION_PLACEHOLDER;
  const displayText = isOutgoing || isImageMessage ? row.original_text : incomingDisplayText;

  return {
    id: row.id,
    clientId: row.client_message_id ?? undefined,
    chatRoomId: row.chat_id,
    senderId: row.sender_id,
    direction: isOutgoing ? "outgoing" : "incoming",
    messageType: (row.message_kind as "text" | "image") ?? "text",
    originalText: row.original_text,
    displayText,
    body: displayText,
    originalBody: isOutgoing ? undefined : row.original_text,
    senderLanguage: row.original_language,
    targetLanguage: isOutgoing
      ? row.original_language
      : translatedLanguage ?? row.original_language,
    language: isOutgoing ? row.original_language : translatedLanguage ?? row.original_language,
    timestamp: formatChatTimestamp(row.created_at),
    createdAt: row.created_at,
    imageUrl: row.attachment_url ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    attachmentContentType: row.attachment_content_type ?? undefined,
    canRetry: isOutgoing,
    reactions: []
  };
}

export function ChatRoomRealtime({
  initialMessages,
  preferImmediateEntry = false,
  room,
  viewerId
}: {
  room: ChatRoomSummary;
  initialMessages: ChatMessage[];
  preferImmediateEntry?: boolean;
  viewerId: string;
}) {
  const locale = useCurrentLocale();
  const [roomState, setRoomState] = useState(room);
  const cachedRoomEntrySnapshot = getCachedRoomEntrySnapshot(room.id);
  const cachedMessages =
    getCachedRoomMessages(room.id) ?? cachedRoomEntrySnapshot?.messages ?? null;
  const hasRoomEntryCache = !!cachedMessages || !!cachedRoomEntrySnapshot;
  const seededMessages = cachedMessages ?? initialMessages;
  const hasSeededMessages = hasRoomEntryCache || seededMessages.length > 0;
  const [messages, setMessages] = useState(
    () => seededMessages
  );
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "reconnecting">(
    "connecting"
  );
  const [hasResolvedInitialScrollTarget, setHasResolvedInitialScrollTarget] = useState(
    () => !!cachedRoomEntrySnapshot
  );
  const [hasRecentMessages, setHasRecentMessages] = useState(() => seededMessages.length > 0);
  const [hasOlderMessages, setHasOlderMessages] = useState(
    () => cachedRoomEntrySnapshot?.hasOlderMessages ?? false
  );
  const [hasWarmRoomEntry, setHasWarmRoomEntry] = useState(() => hasRoomEntryCache);
  const [isInitialRoomLoading, setIsInitialRoomLoading] = useState(
    () => !preferImmediateEntry && !hasRoomEntryCache && seededMessages.length === 0
  );
  const [isOlderMessagesLoading, setIsOlderMessagesLoading] = useState(false);
  const [isRoomRefreshing, setIsRoomRefreshing] = useState(
    () => hasRoomEntryCache || preferImmediateEntry
  );
  const [initialScrollTargetMessageId, setInitialScrollTargetMessageId] = useState<string | null>(
    () => cachedRoomEntrySnapshot?.initialScrollTargetMessageId ?? null
  );
  const [otherUserLastSeenAt, setOtherUserLastSeenAt] = useState<string | null>(
    () => cachedRoomEntrySnapshot?.otherUserLastSeenAt ?? null
  );
  const [bufferedOtherUserLastSeenAt, setBufferedOtherUserLastSeenAt] = useState<string | null>(
    () => cachedRoomEntrySnapshot?.otherUserLastSeenAt ?? null
  );
  const [messageStatusMap, setMessageStatusMap] = useState<MessageStatusMap>(() =>
    buildMessageStatusMap({
      messages: seededMessages,
      otherUserLastSeenAt: cachedRoomEntrySnapshot?.otherUserLastSeenAt ?? null
    })
  );
  const messageStatusMapRef = useRef<MessageStatusMap>(
    buildMessageStatusMap({
      messages: seededMessages,
      otherUserLastSeenAt: cachedRoomEntrySnapshot?.otherUserLastSeenAt ?? null
    })
  );
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const messagesRef = useRef<ChatMessage[]>(seededMessages);
  const messageIdsRef = useRef<Set<string>>(new Set(messages.map((message) => message.id)));
  const otherUserLastSeenAtRef = useRef<string | null>(
    cachedRoomEntrySnapshot?.otherUserLastSeenAt ?? null
  );
  const deferredReadRafRef = useRef<number | null>(null);
  const deferredReadTimeoutRef = useRef<number | null>(null);
  const statusPatchTimerRef = useRef<number | null>(null);
  const pendingStatusPatchRef = useRef<MessageStatusPatchMap>({});
  const initializedRoomEntryKeyRef = useRef<string | null>(null);
  const summaryPrewarmRoomEntryKeyRef = useRef<string | null>(null);
  const pendingOptimisticCommitRef = useRef<{
    messageId: string;
    startedAt: number;
  } | null>(null);
  const hasLoggedFirstMessagePaintRef = useRef(false);
  const hasLoggedEmptyRoomPaintRef = useRef(false);
  const hasLoggedRouteShellMountRef = useRef(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    setRoomState(room);
    hasLoggedFirstMessagePaintRef.current = false;
    hasLoggedEmptyRoomPaintRef.current = false;
    hasLoggedRouteShellMountRef.current = false;
  }, [room]);

  useEffect(() => {
    logRealtime("chat-room mounted", {
      roomId: room.id,
      viewerId
    });

    return () => {
      logRealtime("chat-room unmounted", {
        roomId: room.id,
        viewerId
      });
    };
  }, [room.id, viewerId]);

  const logTimingFromClick = useCallback(
    (eventName: string, extra?: Record<string, unknown>) => {
      if (typeof performance === "undefined") {
        return;
      }

      const clickMarkName = `chat-click:${room.id}`;
      const clickMark = performance.getEntriesByName(clickMarkName).at(-1);
      const elapsedSinceClick = clickMark ? performance.now() - clickMark.startTime : null;

      console.log("chat room timing", {
        roomId: room.id,
        eventName,
        elapsedSinceClickMs:
          elapsedSinceClick !== null ? Math.round(elapsedSinceClick) : null,
        ...extra
      });
    },
    [room.id]
  );

  useEffect(() => {
    if (hasLoggedRouteShellMountRef.current) {
      return;
    }

    hasLoggedRouteShellMountRef.current = true;
    logTimingFromClick("route-shell-mounted");
  }, [logTimingFromClick]);

  useEffect(() => {
    let cancelled = false;

    console.time(`[chat-summary-patch] ${room.id}`);
    logTimingFromClick("summary-patch-start");

    void (async () => {
      const result = await getChatRoomSummaryAction(room.id);

      if (cancelled) {
        return;
      }

      if (result.room) {
        setRoomState(result.room);
      }

      console.timeEnd(`[chat-summary-patch] ${room.id}`);
      logTimingFromClick("summary-patch-complete", {
        hasRoomSummary: !!result.room,
        summaryError: result.error ?? null
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [logTimingFromClick, room.id]);

  const refreshReactions = useCallback(
    async (messageIds: string[]) => {
      if (messageIds.length === 0) {
        return;
      }

      const { data, error } = await supabase
        .from("message_reactions")
        .select("id, message_id, user_id, emoji, created_at")
        .in("message_id", messageIds);

      if (error) {
        console.error("Failed to load message reactions:", error);
        return;
      }

      const reactionsByMessageId = new Map<string, RealtimeReactionRow[]>();

      for (const reaction of (data ?? []) as RealtimeReactionRow[]) {
        const reactionRows = reactionsByMessageId.get(reaction.message_id) ?? [];
        reactionRows.push(reaction);
        reactionsByMessageId.set(reaction.message_id, reactionRows);
      }

      setMessages((current) =>
        applyReactionSummaries(
          current.map((message) =>
            messageIds.includes(message.id) ? { ...message, reactions: [] } : message
          ),
          reactionsByMessageId,
          viewerId
        )
      );
    },
    [supabase, viewerId]
  );

  const updateViewerLastSeen = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("chat_participants")
      .update({ last_seen_at: nowIso })
      .eq("chat_id", room.id)
      .eq("user_id", viewerId);

    if (error) {
      console.error("Failed to update last_seen_at:", error);
      return;
    }

    const { error: summaryError } = await supabase
      .from("chat_room_summaries")
      .update({
        unread_count: 0
      })
      .eq("room_id", room.id)
      .eq("user_id", viewerId);

    if (summaryError) {
      const summaryErrorMessage = String(summaryError.message ?? "").toLowerCase();
      const missingSummaryTable =
        summaryErrorMessage.includes("chat_room_summaries") &&
        (summaryErrorMessage.includes("does not exist") ||
          summaryErrorMessage.includes("could not find the table") ||
          summaryErrorMessage.includes("could not find relation"));

      if (!missingSummaryTable) {
        console.error("Failed to patch chat_room_summaries unread_count:", summaryError);
      }
    }

    patchCachedChatPreview(room.id, (preview) => ({
      ...preview,
      unreadCount: 0,
      viewerLastSeenAt: nowIso
    }));
  }, [room.id, supabase, viewerId]);

  const flushMessageStatusPatch = useCallback(() => {
    const pendingPatch = pendingStatusPatchRef.current;

    if (Object.keys(pendingPatch).length === 0) {
      return;
    }

    pendingStatusPatchRef.current = {};
    if (statusPatchTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(statusPatchTimerRef.current);
      statusPatchTimerRef.current = null;
    }

    setMessageStatusMap((current) => {
      let hasChanges = false;
      const next: MessageStatusMap = { ...current };

      for (const [statusKey, patch] of Object.entries(pendingPatch)) {
        const currentEntry = current[statusKey] ?? {
          deliveryStatus: "sent",
          readStatus: null
        };
        const nextEntry: MessageStatusEntry = {
          deliveryStatus: patch.deliveryStatus ?? currentEntry.deliveryStatus,
          readStatus: patch.readStatus ?? currentEntry.readStatus
        };

        if (
          nextEntry.deliveryStatus !== currentEntry.deliveryStatus ||
          nextEntry.readStatus !== currentEntry.readStatus
        ) {
          next[statusKey] = nextEntry;
          hasChanges = true;
        }
      }

      return hasChanges ? next : current;
    });
  }, []);

  const queueMessageStatusPatch = useCallback(
    (patch: MessageStatusPatchMap, options?: { immediate?: boolean }) => {
      pendingStatusPatchRef.current = {
        ...pendingStatusPatchRef.current,
        ...patch
      };

      if (options?.immediate || typeof window === "undefined") {
        flushMessageStatusPatch();
        return;
      }

      if (statusPatchTimerRef.current !== null) {
        window.clearTimeout(statusPatchTimerRef.current);
      }

      statusPatchTimerRef.current = window.setTimeout(() => {
        statusPatchTimerRef.current = null;
        flushMessageStatusPatch();
      }, MESSAGE_STATUS_PATCH_BUFFER_MS);
    },
    [flushMessageStatusPatch]
  );

  const cancelDeferredReadUpdate = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (deferredReadRafRef.current !== null) {
      window.cancelAnimationFrame(deferredReadRafRef.current);
      deferredReadRafRef.current = null;
    }

    if (deferredReadTimeoutRef.current !== null) {
      window.clearTimeout(deferredReadTimeoutRef.current);
      deferredReadTimeoutRef.current = null;
    }
  }, []);

  const queueDeferredReadUpdate = useCallback(() => {
    if (typeof window === "undefined") {
      void updateViewerLastSeen();
      return;
    }

    cancelDeferredReadUpdate();
    deferredReadRafRef.current = window.requestAnimationFrame(() => {
      deferredReadRafRef.current = window.requestAnimationFrame(() => {
        deferredReadRafRef.current = null;
        deferredReadTimeoutRef.current = window.setTimeout(() => {
          deferredReadTimeoutRef.current = null;
          void updateViewerLastSeen();
        }, 0);
      });
    });
  }, [cancelDeferredReadUpdate, updateViewerLastSeen]);

  const syncChatPreviewCache = useCallback(
    (params: {
      createdAt: string;
      debugReason: string;
      messageId: string;
      messageType?: "text" | "image";
      previewText: string;
    }) => {
      const latestMessagePreview =
        params.messageType === "image" ? "Photo" : params.previewText;

      console.log("chat room preview patch", {
        roomId: room.id,
        reason: params.debugReason,
        latestMessagePreview,
        latestMessageCreatedAt: params.createdAt,
        lastMessageId: params.messageId
      });

      patchCachedChatPreview(
        room.id,
        (preview) => ({
          ...preview,
          latestMessagePreview,
          latestMessageAt: formatChatTimestamp(params.createdAt),
          latestMessageCreatedAt: params.createdAt,
          lastMessageId: params.messageId,
          unreadCount: 0,
          viewerLastSeenAt: params.createdAt
        }),
        {
          moveToFront: true
        }
      );
    },
    [room.id]
  );

  const appendMissingMessageById = useCallback(
    async (params: {
      messageId: string;
      reason: "summary-update" | "translation-insert";
      translatedLanguage?: string | null;
      translatedText?: string | null;
    }) => {
      const { messageId, reason, translatedLanguage, translatedText } = params;

      if (!messageId) {
        logRealtime("dedupe skipped reason", {
          roomId: room.id,
          reason: "missing-message-id",
          source: reason
        }, "debug");
        return;
      }

      if (messageIdsRef.current.has(messageId)) {
        logRealtime("dedupe skipped reason", {
          roomId: room.id,
          messageId,
          reason: "already-present-before-fallback",
          source: reason
        }, "debug");
        return;
      }

      const { data: fetchedMessage, error: messageError } = (await supabase
        .from("messages")
        .select(
          "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
        )
        .eq("chat_id", room.id)
        .eq("id", messageId)
        .maybeSingle()) as {
        data: RealtimeMessageRow | null;
        error: { message?: string } | null;
      };

      if (messageError || !fetchedMessage) {
        logRealtime("dedupe skipped reason", {
          roomId: room.id,
          messageId,
          reason: "fallback-fetch-failed",
          source: reason,
          error: messageError
        }, "warn");
        return;
      }

      logRealtime("subscription event received", {
        source: reason,
        roomId: room.id,
        messageId: fetchedMessage.id,
        senderId: fetchedMessage.sender_id,
        receivedRoomId: fetchedMessage.chat_id
      });

      setMessages((current) => {
        if (current.some((message) => message.id === fetchedMessage.id)) {
          logRealtime("dedupe skipped reason", {
            roomId: room.id,
            messageId: fetchedMessage.id,
            reason: "already-present-on-fallback-append",
            source: reason
          }, "debug");
          return current;
        }

        const nextMessages = sortMessages([
          ...current,
          mapRealtimeRowToMessage({
            row: fetchedMessage,
            viewerId,
            translatedLanguage,
            translatedText
          })
        ]);

        logRealtime("setMessages append executed", {
          roomId: room.id,
          messageId: fetchedMessage.id,
          source: reason,
          previousCount: current.length,
          nextCount: nextMessages.length
        });

        return nextMessages;
      });

      syncChatPreviewCache({
        debugReason: `room-realtime-${reason}-append`,
        messageId: fetchedMessage.id,
        messageType: fetchedMessage.message_kind ?? undefined,
        previewText: fetchedMessage.original_text,
        createdAt: fetchedMessage.created_at
      });
    },
    [room.id, supabase, syncChatPreviewCache, viewerId]
  );

  const prewarmChatSummariesForHomeReturn = useCallback(async () => {
    const { data: summaryRows, error: summaryError } = (await supabase
      .from("chat_room_summaries")
      .select(
        "room_id, peer_user_id, peer_display_name_snapshot, peer_avatar_snapshot, last_message_id, last_message_preview, last_message_created_at, unread_count, updated_at"
      )
      .eq("user_id", viewerId)
      .order("updated_at", { ascending: false })
      .limit(HOME_CACHE_PREWARM_SUMMARY_LIMIT)) as {
      data: ChatRoomSummaryCacheRow[] | null;
      error: { message?: string } | null;
    };

    if (summaryError) {
      const summaryErrorMessage = String(summaryError.message ?? "").toLowerCase();
      const missingSummaryTable =
        summaryErrorMessage.includes("chat_room_summaries") &&
        (summaryErrorMessage.includes("does not exist") ||
          summaryErrorMessage.includes("could not find the table") ||
          summaryErrorMessage.includes("could not find relation"));

      if (!missingSummaryTable) {
        console.error("chat summary prewarm failed", {
          roomId: room.id,
          viewerId,
          summaryError
        });
      }
      return;
    }

    const summaryPreviews = (summaryRows ?? []).map((summaryRow, index) => {
      const latestMessageCreatedAt =
        summaryRow.last_message_created_at ?? summaryRow.updated_at ?? undefined;

      return {
        id: `chat-preview-${summaryRow.room_id}`,
        roomId: summaryRow.room_id,
        peerUserId: summaryRow.peer_user_id ?? undefined,
        recipientName:
          summaryRow.peer_display_name_snapshot?.trim() || "Untitled chat",
        recipientAvatarUrl: summaryRow.peer_avatar_snapshot ?? undefined,
        latestMessagePreview:
          summaryRow.last_message_preview?.trim() || "No messages yet.",
        latestMessageAt: latestMessageCreatedAt
          ? formatChatTimestamp(latestMessageCreatedAt)
          : "Just now",
        latestMessageCreatedAt,
        lastMessageId: summaryRow.last_message_id ?? undefined,
        unreadCount: Math.max(0, summaryRow.unread_count ?? 0),
        selected: index === 0
      };
    });

    if (summaryPreviews.length === 0) {
      return;
    }

    const mergedPreviews = mergeChatPreviews(getCachedChatPreviews(), summaryPreviews);
    setCachedChatPreviews(mergedPreviews);

    console.log("chat summary prewarm complete", {
      roomId: room.id,
      viewerId,
      summaryPreviewCount: summaryPreviews.length,
      mergedPreviewCount: mergedPreviews.length
    });
  }, [room.id, supabase, viewerId]);

  const applyInitialRoomBatch = useCallback(
    (params: {
      firstUnreadMessageId: string | null;
      hasOlderMessages: boolean;
      messages: ChatMessage[];
      otherUserLastSeenAt: string | null;
    }) => {
      otherUserLastSeenAtRef.current = params.otherUserLastSeenAt;
      setOtherUserLastSeenAt(params.otherUserLastSeenAt);
      setInitialScrollTargetMessageId(params.firstUnreadMessageId);
      setHasResolvedInitialScrollTarget(true);
      setHasOlderMessages(params.hasOlderMessages);
      setHasRecentMessages(params.messages.length > 0);
      setMessages((current) =>
        mergeServerMessages({
          current,
          serverMessages: params.messages,
          currentStatusMap: messageStatusMapRef.current
        })
      );
    },
    []
  );

  const loadInitialRoomState = useCallback(async () => {
    if (hasSeededMessages || preferImmediateEntry) {
      setIsRoomRefreshing(true);
    } else {
      setIsInitialRoomLoading(true);
    }
    setIsRealtimeReady(false);

    const prewarmInflightKey = getRoomInflightKey("prewarm-room", room.id, viewerId);

    try {
      console.time(`[room-init-base] ${room.id}`);
      logTimingFromClick("room-init-base-start", {
        hasSeededMessages,
        preferImmediateEntry
      });

      const initialSnapshot = getCachedRoomEntrySnapshot(room.id);
      let usedCachedSnapshot = false;
      let baseMessageCount = 0;

      if (initialSnapshot?.messages?.length) {
        baseMessageCount = initialSnapshot.messages.length;
        setHasWarmRoomEntry(true);
        applyInitialRoomBatch({
          firstUnreadMessageId: initialSnapshot.initialScrollTargetMessageId ?? null,
          hasOlderMessages: initialSnapshot.hasOlderMessages ?? false,
          messages: initialSnapshot.messages,
          otherUserLastSeenAt: initialSnapshot.otherUserLastSeenAt ?? null
        });
        usedCachedSnapshot = true;
      } else {
        const prewarmInflight = getRoomInflightRequest<void>(prewarmInflightKey);

        if (prewarmInflight) {
          await Promise.race([prewarmInflight, waitForHandoff(PREWARM_HANDOFF_WAIT_MS)]);
        }

        const handoffSnapshot = getCachedRoomEntrySnapshot(room.id);

        if (handoffSnapshot?.messages?.length) {
          baseMessageCount = handoffSnapshot.messages.length;
          setHasWarmRoomEntry(true);
          applyInitialRoomBatch({
            firstUnreadMessageId: handoffSnapshot.initialScrollTargetMessageId ?? null,
            hasOlderMessages: handoffSnapshot.hasOlderMessages ?? false,
            messages: handoffSnapshot.messages,
            otherUserLastSeenAt: handoffSnapshot.otherUserLastSeenAt ?? null
          });
          usedCachedSnapshot = true;
        } else {
          const baseBatch = await fetchInitialRoomBaseMessageBatchWithDedupe({
            roomId: room.id,
            supabase,
            viewerId
          });
          baseMessageCount = baseBatch.messages.length;

          applyInitialRoomBatch({
            firstUnreadMessageId: null,
            hasOlderMessages: false,
            messages: baseBatch.messages,
            otherUserLastSeenAt: baseBatch.otherUserLastSeenAt
          });
        }
      }

      setIsRealtimeReady(true);
      queueDeferredReadUpdate();

      logTimingFromClick("room-init-base-complete", {
        usedCachedSnapshot,
        baseMessageCount
      });
      console.timeEnd(`[room-init-base] ${room.id}`);

      console.time(`[room-init-enrich] ${room.id}`);
      logTimingFromClick("room-init-enrich-start");

      void (async () => {
        try {
          const enrichedBatch = await fetchInitialRoomMessageBatchWithDedupe({
            roomId: room.id,
            supabase,
            viewerId
          });

          applyInitialRoomBatch({
            firstUnreadMessageId: enrichedBatch.firstUnreadMessageId,
            hasOlderMessages: enrichedBatch.hasOlderMessages,
            messages: enrichedBatch.messages,
            otherUserLastSeenAt: enrichedBatch.otherUserLastSeenAt
          });

          logTimingFromClick("room-init-enrich-complete", {
            enrichedMessageCount: enrichedBatch.messages.length,
            hasOlderMessages: enrichedBatch.hasOlderMessages
          });
        } catch (error) {
          console.error("Failed to enrich initial room state:", error);
          logTimingFromClick("room-init-enrich-failed");
        } finally {
          console.timeEnd(`[room-init-enrich] ${room.id}`);
        }
      })();
    } catch (error) {
      console.error("Failed to load initial room state:", error);
      setInitialScrollTargetMessageId(null);
      setHasResolvedInitialScrollTarget(true);
      setIsRealtimeReady(true);
    } finally {
      setIsInitialRoomLoading(false);
      setIsRoomRefreshing(false);
    }
  }, [
    applyInitialRoomBatch,
    hasSeededMessages,
    logTimingFromClick,
    preferImmediateEntry,
    queueDeferredReadUpdate,
    room.id,
    supabase,
    viewerId
  ]);

  const loadOlderMessages = useCallback(async () => {
    if (isOlderMessagesLoading || !hasOlderMessages || messages.length === 0) {
      return;
    }

    const beforeCreatedAt = messages[0]?.createdAt;

    if (!beforeCreatedAt) {
      setHasOlderMessages(false);
      return;
    }

    setIsOlderMessagesLoading(true);

    try {
      const batch = await fetchOlderRoomMessageBatch({
        beforeCreatedAt,
        roomId: room.id,
        supabase,
        viewerId
      });

      setHasOlderMessages(batch.hasOlderMessages);

      if (batch.messages.length === 0) {
        return;
      }

      setMessages((current) => {
        const currentIds = new Set(current.map((message) => message.id));
        const uniqueOlderMessages = batch.messages.filter((message) => !currentIds.has(message.id));

        if (uniqueOlderMessages.length === 0) {
          return current;
        }

        return sortMessages([...uniqueOlderMessages, ...current]);
      });
    } catch (error) {
      console.error("Failed to load older room messages:", error);
    } finally {
      setIsOlderMessagesLoading(false);
    }
  }, [
    hasOlderMessages,
    isOlderMessagesLoading,
    messages,
    room.id,
    supabase,
    viewerId
  ]);

  const handleOptimisticSend = useCallback(
    (optimisticMessage: {
      id: string;
      clientId: string;
      body: string;
      originalText: string;
      attachmentContentType?: string;
      attachmentName?: string;
      imageUrl?: string;
      messageType?: "text" | "image";
      canRetry?: boolean;
      senderLanguage?: string;
      createdAt: string;
    }) => {
      pendingOptimisticCommitRef.current = {
        messageId: optimisticMessage.id,
        startedAt: performance.now()
      };
      const optimisticStatusKey = optimisticMessage.clientId ?? optimisticMessage.id;

      queueMessageStatusPatch(
        {
          [optimisticMessage.id]: {
            deliveryStatus: "sending",
            readStatus: null
          },
          [optimisticStatusKey]: {
            deliveryStatus: "sending",
            readStatus: null
          }
        },
        { immediate: true }
      );

      setMessages((current) => [
        ...current,
        {
          id: optimisticMessage.id,
          clientId: optimisticMessage.clientId,
          chatRoomId: room.id,
          senderId: viewerId,
          direction: "outgoing",
          messageType: optimisticMessage.messageType ?? "text",
          originalText: optimisticMessage.originalText,
          displayText: optimisticMessage.body,
          body: optimisticMessage.body,
          senderLanguage: optimisticMessage.senderLanguage,
          targetLanguage: optimisticMessage.senderLanguage,
          language: optimisticMessage.senderLanguage ?? "",
          timestamp: formatChatTimestamp(optimisticMessage.createdAt),
          createdAt: optimisticMessage.createdAt,
          imageUrl: optimisticMessage.imageUrl,
          attachmentName: optimisticMessage.attachmentName,
          attachmentContentType: optimisticMessage.attachmentContentType,
          canRetry: optimisticMessage.canRetry ?? true,
          reactions: []
        }
      ]);
    },
    [queueMessageStatusPatch, room.id, viewerId]
  );

  const handleSendSucceeded = useCallback(
    (
      tempId: string,
      message: {
        id: string;
        clientId?: string;
        attachmentContentType?: string;
        attachmentName?: string;
        imageUrl?: string;
        messageType?: "text" | "image";
        originalText: string;
        originalLanguage: string;
        targetLanguage?: string;
        createdAt: string;
      }
    ) => {
      const statusKey = message.clientId ?? tempId;
      queueMessageStatusPatch({
        [tempId]: {
          deliveryStatus: "sent",
          readStatus: null
        },
        [statusKey]: {
          deliveryStatus: "sent",
          readStatus: null
        }
      });

      setMessages((current) =>
        current.map((item) =>
          item.id === tempId || (!!message.clientId && item.clientId === message.clientId)
            ? {
                ...item,
                id: message.id,
                clientId: message.clientId ?? item.clientId,
                originalText: message.originalText,
                displayText: message.originalText,
                body: message.originalText,
                messageType: message.messageType ?? item.messageType ?? "text",
                language: message.originalLanguage,
                senderLanguage: message.originalLanguage,
                targetLanguage: message.targetLanguage ?? message.originalLanguage,
                createdAt: message.createdAt,
                timestamp: formatChatTimestamp(message.createdAt),
                imageUrl: message.imageUrl ?? item.imageUrl,
                attachmentName: message.attachmentName ?? item.attachmentName,
                attachmentContentType:
                  message.attachmentContentType ?? item.attachmentContentType,
                canRetry: item.canRetry ?? true
              }
            : item
        )
      );

      syncChatPreviewCache({
        debugReason: "send-success",
        messageId: message.id,
        messageType: message.messageType,
        previewText: message.originalText,
        createdAt: message.createdAt
      });
    },
    [queueMessageStatusPatch, syncChatPreviewCache]
  );

  const handleSendFailed = useCallback((tempId: string) => {
    queueMessageStatusPatch(
      {
        [tempId]: {
          deliveryStatus: "failed",
          readStatus: null
        }
      },
      { immediate: true }
    );
  }, [queueMessageStatusPatch]);

  const sendTextMessage = useCallback(
    async (rawText: string) => {
      const trimmedMessage = rawText.trim();

      if (!trimmedMessage || isChatMessageTooLong(trimmedMessage)) {
        return;
      }

      const clientId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `client-${Date.now()}`;
      const optimisticMessage = {
        id: `temp-${clientId}`,
        clientId,
        body: trimmedMessage,
        originalText: trimmedMessage,
        senderLanguage: roomState.myLanguage,
        createdAt: new Date().toISOString()
      };

      flushSync(() => {
        handleOptimisticSend(optimisticMessage);
      });

      const formData = new FormData();
      formData.set("chatId", room.id);
      formData.set("clientMessageId", clientId);
      formData.set("message", trimmedMessage);
      formData.set("locale", locale);

      const result = await sendMessageAction(initialSendMessageFormState, formData);

      if (result.error || !result.message) {
        handleSendFailed(optimisticMessage.id);
        return;
      }

      handleSendSucceeded(optimisticMessage.id, result.message);
    },
    [handleOptimisticSend, handleSendFailed, handleSendSucceeded, locale, room.id, roomState.myLanguage]
  );

  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      const failedMessage = messagesRef.current.find((message) => message.id === messageId);

      if (
        !failedMessage ||
        failedMessage.direction !== "outgoing" ||
        failedMessage.messageType === "image"
      ) {
        return;
      }

      if (isChatMessageTooLong(failedMessage.originalText ?? failedMessage.body)) {
        console.warn("retry blocked because message exceeds max length", {
          roomId: room.id,
          messageId
        });
        return;
      }

      const clientId =
        failedMessage.clientId ||
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `client-${Date.now()}`);
      const previousStatusKey = getMessageStatusKey(failedMessage);

      queueMessageStatusPatch(
        {
          [previousStatusKey]: {
            deliveryStatus: "sending",
            readStatus: null
          },
          [clientId]: {
            deliveryStatus: "sending",
            readStatus: null
          }
        },
        { immediate: true }
      );

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                clientId
              }
            : message
        )
      );

      const formData = new FormData();
      formData.set("chatId", room.id);
      formData.set("clientMessageId", clientId);
      formData.set("message", failedMessage.originalText ?? failedMessage.body);
      formData.set("locale", locale);

      const result = await sendMessageAction(initialSendMessageFormState, formData);

      if (result.error) {
        queueMessageStatusPatch(
          {
            [clientId]: {
              deliveryStatus: "failed",
              readStatus: null
            },
            [messageId]: {
              deliveryStatus: "failed",
              readStatus: null
            }
          },
          { immediate: true }
        );
        return;
      }

      if (!result.message) {
        return;
      }

      const resolvedStatusKey = result.message.clientId ?? result.message.id;
      queueMessageStatusPatch({
        [clientId]: {
          deliveryStatus: "sent",
          readStatus: null
        },
        [resolvedStatusKey]: {
          deliveryStatus: "sent",
          readStatus: null
        }
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                id: result.message?.id ?? message.id,
                clientId: result.message?.clientId ?? clientId,
                chatRoomId: result.message?.chatId ?? room.id,
                originalText: result.message?.originalText ?? message.originalText,
                displayText: result.message?.originalText ?? message.displayText ?? message.body,
                body: result.message?.originalText ?? message.body,
                senderLanguage: result.message?.originalLanguage ?? message.senderLanguage,
                targetLanguage:
                  result.message?.targetLanguage ??
                  result.message?.originalLanguage ??
                  message.targetLanguage,
                language: result.message?.originalLanguage ?? message.language,
                createdAt: result.message?.createdAt ?? message.createdAt,
                timestamp: formatChatTimestamp(
                  result.message?.createdAt ?? message.createdAt ?? new Date().toISOString()
                )
              }
            : message
        )
      );

      syncChatPreviewCache({
        debugReason: "retry-send-success",
        messageId: result.message.id,
        messageType: result.message.messageType,
        previewText: result.message.originalText,
        createdAt: result.message.createdAt
      });
    },
    [locale, queueMessageStatusPatch, room.id, syncChatPreviewCache]
  );

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const message = messagesRef.current.find((item) => item.id === messageId);

      if (!message || message.direction !== "incoming") {
        return;
      }

      const alreadyReacted =
        message.reactions?.some((reaction) => reaction.emoji === emoji && reaction.reactedByViewer) ??
        false;

      if (alreadyReacted) {
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", viewerId)
          .eq("emoji", emoji);

        if (error) {
          console.error("Failed to remove reaction:", error);
          return;
        }
      } else {
        const { error } = await supabase.from("message_reactions").insert({
          message_id: messageId,
          user_id: viewerId,
          emoji
        });

        if (error) {
          console.error("Failed to add reaction:", error);
          return;
        }
      }

      await refreshReactions([messageId]);
    },
    [refreshReactions, supabase, viewerId]
  );

  useEffect(() => {
    messagesRef.current = messages;
    messageIdsRef.current = new Set(messages.map((message) => message.id));
    setCachedRoomMessages(room.id, messages);
    setCachedRoomEntrySnapshot(room.id, {
      initialScrollTargetMessageId,
      hasOlderMessages,
      messages,
      otherUserLastSeenAt,
      preloadedAt: Date.now()
    });
  }, [hasOlderMessages, initialScrollTargetMessageId, messages, otherUserLastSeenAt, room.id]);

  useEffect(() => {
    otherUserLastSeenAtRef.current = otherUserLastSeenAt;
  }, [otherUserLastSeenAt]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setBufferedOtherUserLastSeenAt(otherUserLastSeenAt);
      return;
    }

    const timer = window.setTimeout(() => {
      setBufferedOtherUserLastSeenAt(otherUserLastSeenAt);
    }, MESSAGE_STATUS_PATCH_BUFFER_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [otherUserLastSeenAt]);

  useEffect(() => {
    setMessageStatusMap((current) => {
      const next = buildMessageStatusMap({
        messages,
        otherUserLastSeenAt: bufferedOtherUserLastSeenAt,
        previousStatusMap: current
      });
      return areMessageStatusMapsEqual(current, next) ? current : next;
    });
  }, [bufferedOtherUserLastSeenAt, messages]);

  useEffect(() => {
    messageStatusMapRef.current = messageStatusMap;
  }, [messageStatusMap]);

  useEffect(() => {
    recordRecentChatRoom(room.id);
  }, [room.id]);

  useEffect(() => {
    setHasRecentMessages(messages.length > 0);
  }, [messages.length]);

  useEffect(() => {
    if (messages.length === 0 || hasLoggedFirstMessagePaintRef.current) {
      return;
    }

    hasLoggedFirstMessagePaintRef.current = true;

    const frameHandle = window.requestAnimationFrame(() => {
      logTimingFromClick("first-message-paint", {
        renderedMessageCount: messages.length
      });

      try {
        console.timeEnd(`[chat-open-total] ${room.id}`);
      } catch {
        // no-op when timer was not started from chat list click
      }
    });

    return () => {
      window.cancelAnimationFrame(frameHandle);
    };
  }, [logTimingFromClick, messages.length, room.id]);

  useEffect(() => {
    if (
      hasLoggedFirstMessagePaintRef.current ||
      hasLoggedEmptyRoomPaintRef.current ||
      messages.length > 0 ||
      !hasResolvedInitialScrollTarget ||
      isInitialRoomLoading ||
      isRoomRefreshing
    ) {
      return;
    }

    hasLoggedEmptyRoomPaintRef.current = true;
    logTimingFromClick("empty-room-paint");

    try {
      console.timeEnd(`[chat-open-total] ${room.id}`);
    } catch {
      // no-op when timer was not started from chat list click
    }
  }, [
    hasResolvedInitialScrollTarget,
    isInitialRoomLoading,
    isRoomRefreshing,
    logTimingFromClick,
    messages.length,
    room.id
  ]);

  useEffect(() => {
    const pendingCommit = pendingOptimisticCommitRef.current;

    if (!pendingCommit) {
      return;
    }

    if (!messages.some((message) => message.id === pendingCommit.messageId)) {
      return;
    }

    console.log("optimistic append committed", {
      roomId: room.id,
      messageId: pendingCommit.messageId,
      at: performance.now(),
      deltaFromAppendStart: performance.now() - pendingCommit.startedAt
    });
    pendingOptimisticCommitRef.current = null;
  }, [messages, room.id]);

  useEffect(() => {
    const roomEntryKey = getRoomEntryKey(room.id, viewerId);

    if (initializedRoomEntryKeyRef.current === roomEntryKey) {
      return;
    }

    initializedRoomEntryKeyRef.current = roomEntryKey;
    void loadInitialRoomState();
  }, [loadInitialRoomState, room.id, viewerId]);

  useEffect(() => {
    if (!isRealtimeReady) {
      return;
    }

    const roomEntryKey = getRoomEntryKey(room.id, viewerId);

    if (summaryPrewarmRoomEntryKeyRef.current === roomEntryKey) {
      return;
    }

    summaryPrewarmRoomEntryKeyRef.current = roomEntryKey;

    if (typeof window === "undefined") {
      void prewarmChatSummariesForHomeReturn();
      return;
    }

    const timer = window.setTimeout(() => {
      void prewarmChatSummariesForHomeReturn();
    }, ROOM_ENTRY_SUMMARY_PREWARM_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isRealtimeReady, prewarmChatSummariesForHomeReturn, room.id, viewerId]);

  useEffect(() => {
    if (!isRealtimeReady) {
      return;
    }

    const channel = supabase.channel(`chat-room:${room.id}:${viewerId}`);
    logRealtime("subscription created", {
      roomId: room.id,
      viewerId
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${room.id}`
        },
        (payload) => {
          const row = payload.new as RealtimeMessageRow;
          logRealtime("subscription event received", {
            source: "messages-insert",
            roomId: room.id,
            receivedRoomId: row.chat_id,
            messageId: row.id,
            senderId: row.sender_id
          });

          if (row.chat_id !== room.id) {
            logRealtime("dedupe skipped reason", {
              roomId: room.id,
              receivedRoomId: row.chat_id,
              messageId: row.id,
              reason: "room-mismatch",
              source: "messages-insert"
            }, "debug");
            return;
          }

          let appendMode: "replace-optimistic" | "append-new" | null = null;
          setMessages((current) => {
            if (current.some((message) => message.id === row.id)) {
              logRealtime("dedupe skipped reason", {
                roomId: room.id,
                messageId: row.id,
                reason: "already-present",
                source: "messages-insert"
              }, "debug");
              return current;
            }

            const matchingTemp =
              row.client_message_id != null
                ? current.find(
                    (message) =>
                      messageStatusMapRef.current[getMessageStatusKey(message)]?.deliveryStatus ===
                        "sending" &&
                      message.direction === "outgoing" &&
                      message.clientId === row.client_message_id
                  )
                : undefined;

            let nextMessages = current;

            if (matchingTemp) {
              appendMode = "replace-optimistic";
              nextMessages = current.map((message) =>
                message.id === matchingTemp.id
                  ? {
                      ...message,
                      id: row.id,
                      clientId: row.client_message_id ?? message.clientId,
                      chatRoomId: row.chat_id,
                      senderId: row.sender_id,
                      originalText: row.original_text,
                      displayText: row.original_text,
                      body: row.original_text,
                      messageType: (row.message_kind as "text" | "image") ?? message.messageType,
                      senderLanguage: row.original_language,
                      targetLanguage: row.original_language,
                      language: row.original_language,
                      createdAt: row.created_at,
                      timestamp: formatChatTimestamp(row.created_at),
                      imageUrl: row.attachment_url ?? message.imageUrl,
                      attachmentName: row.attachment_name ?? message.attachmentName,
                      attachmentContentType:
                        row.attachment_content_type ?? message.attachmentContentType
                    }
                  : message
              );
            } else {
              appendMode = "append-new";
              nextMessages = [
                ...current,
                {
                  id: row.id,
                  clientId: row.client_message_id ?? undefined,
                  chatRoomId: row.chat_id,
                  senderId: row.sender_id,
                  direction: row.sender_id === viewerId ? "outgoing" : "incoming",
                  messageType: (row.message_kind as "text" | "image") ?? "text",
                  originalText: row.original_text,
                  displayText:
                    row.sender_id === viewerId || row.message_kind === "image"
                      ? row.original_text
                      : PENDING_TRANSLATION_PLACEHOLDER,
                  body:
                    row.sender_id === viewerId || row.message_kind === "image"
                      ? row.original_text
                      : PENDING_TRANSLATION_PLACEHOLDER,
                  originalBody: row.sender_id === viewerId ? undefined : row.original_text,
                  senderLanguage: row.original_language,
                  targetLanguage: row.original_language,
                  language: row.original_language,
                  timestamp: formatChatTimestamp(row.created_at),
                  createdAt: row.created_at,
                  imageUrl: row.attachment_url ?? undefined,
                  attachmentName: row.attachment_name ?? undefined,
                  attachmentContentType: row.attachment_content_type ?? undefined,
                  canRetry: row.sender_id === viewerId,
                  reactions: []
                }
              ];
            }

            logRealtime("setMessages append executed", {
              roomId: room.id,
              messageId: row.id,
              senderId: row.sender_id,
              appendMode,
              previousCount: current.length,
              nextCount: nextMessages.length
            });

            return nextMessages;
          });

          if (row.sender_id === viewerId) {
            const sentStatusPatch: MessageStatusPatchMap = {
              [row.id]: {
                deliveryStatus: "sent",
                readStatus: null
              }
            };

            if (row.client_message_id) {
              sentStatusPatch[row.client_message_id] = {
                deliveryStatus: "sent",
                readStatus: null
              };
            }

            queueMessageStatusPatch(sentStatusPatch);
          } else {
            void queueDeferredReadUpdate();
          }

          syncChatPreviewCache({
            debugReason:
              row.sender_id === viewerId ? "room-realtime-outgoing" : "room-realtime-incoming",
            messageId: row.id,
            messageType: row.message_kind ?? undefined,
            previewText: row.original_text,
            createdAt: row.created_at
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_translations",
          filter: `target_user_id=eq.${viewerId}`
        },
        (payload) => {
          const row = payload.new as RealtimeTranslationRow;
          logRealtime("subscription event received", {
            source: "message-translation-insert",
            roomId: room.id,
            receivedRoomId: room.id,
            messageId: row.message_id,
            senderId: null
          });

          if (!row.message_id) {
            logRealtime("dedupe skipped reason", {
              roomId: room.id,
              reason: "missing-message-id",
              source: "message-translation-insert"
            }, "debug");
            return;
          }

          const hadMessageBeforePatch = messageIdsRef.current.has(row.message_id);

          setMessages((current) => {
            let didPatch = false;
            const patched = current.map((message) =>
              message.id === row.message_id && message.direction === "incoming"
                ? {
                    ...message,
                    displayText: row.translated_text,
                    body: row.translated_text,
                    targetLanguage: row.target_language,
                    language: row.target_language
                  }
                : message
            );

            for (let index = 0; index < current.length; index += 1) {
              if (current[index] !== patched[index]) {
                didPatch = true;
                break;
              }
            }

            if (didPatch) {
              logRealtime("setMessages append executed", {
                roomId: room.id,
                messageId: row.message_id,
                senderId: null,
                appendMode: "translation-patch",
                previousCount: current.length,
                nextCount: patched.length
              });
            } else {
              logRealtime("dedupe skipped reason", {
                roomId: room.id,
                messageId: row.message_id,
                reason: hadMessageBeforePatch
                  ? "translation-patch-no-change"
                  : "translation-target-message-not-found",
                source: "message-translation-insert"
              }, "debug");
            }

            return patched;
          });

          if (!hadMessageBeforePatch) {
            void appendMissingMessageById({
              messageId: row.message_id,
              reason: "translation-insert",
              translatedText: row.translated_text,
              translatedLanguage: row.target_language
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_participants",
          filter: `chat_id=eq.${room.id}`
        },
        (payload) => {
          const updatedRow = payload.new as RealtimeParticipantRow;

          if (updatedRow.user_id === viewerId) {
            return;
          }

          otherUserLastSeenAtRef.current = updatedRow.last_seen_at;
          setOtherUserLastSeenAt(updatedRow.last_seen_at);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions"
        },
        (payload) => {
          const row = payload.new as RealtimeReactionRow;

          if (!messageIdsRef.current.has(row.message_id)) {
            return;
          }

          void refreshReactions([row.message_id]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions"
        },
        (payload) => {
          const row = payload.old as Partial<RealtimeReactionRow>;

          if (!row.message_id || !messageIdsRef.current.has(row.message_id)) {
            return;
          }

          void refreshReactions([row.message_id]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_room_summaries",
          filter: `user_id=eq.${viewerId}`
        },
        (payload) => {
          const row = payload.new as RealtimeSummaryUpdateRow;
          if (row.room_id !== room.id) {
            return;
          }

          logRealtime("subscription event received", {
            source: "chat-room-summary-update",
            roomId: room.id,
            receivedRoomId: row.room_id,
            messageId: row.last_message_id ?? null,
            senderId: null
          });

          if (!row.last_message_id) {
            logRealtime("dedupe skipped reason", {
              roomId: room.id,
              reason: "summary-missing-last-message-id",
              source: "chat-room-summary-update"
            }, "debug");
            return;
          }

          void appendMissingMessageById({
            messageId: row.last_message_id,
            reason: "summary-update"
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionState("connected");
          logTimingFromClick("realtime-subscribed");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionState("reconnecting");
        } else {
          setConnectionState("connecting");
        }
      });

    return () => {
      logRealtime("unsubscribe executed", {
        roomId: room.id,
        viewerId
      });
      void supabase.removeChannel(channel);
    };
  }, [
    appendMissingMessageById,
    isRealtimeReady,
    logTimingFromClick,
    queueDeferredReadUpdate,
    queueMessageStatusPatch,
    refreshReactions,
    room.id,
    syncChatPreviewCache,
    supabase,
    viewerId
  ]);

  useEffect(
    () => () => {
      cancelDeferredReadUpdate();
      if (statusPatchTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(statusPatchTimerRef.current);
        statusPatchTimerRef.current = null;
      }
      pendingStatusPatchRef.current = {};
    },
    [cancelDeferredReadUpdate]
  );

  return (
    <ChatRoom
      room={roomState}
      messages={messages}
      messageStatusMap={messageStatusMap}
      connectionState={connectionState}
      hasOlderMessages={hasOlderMessages}
      hasRecentMessages={hasRecentMessages}
      hasResolvedInitialScrollTarget={hasResolvedInitialScrollTarget}
      initialScrollTargetMessageId={initialScrollTargetMessageId}
      isInitialRoomLoading={isInitialRoomLoading}
      isOlderMessagesLoading={isOlderMessagesLoading}
      isRoomRefreshing={isRoomRefreshing}
      suppressInitialSkeleton={preferImmediateEntry || hasWarmRoomEntry}
      onDeleteHistory={() => {
        clearCachedRoomMessages(room.id);
        clearCachedRoomEntrySnapshot(room.id);
        setMessages([]);
        setHasOlderMessages(false);
        setHasRecentMessages(false);
      }}
      onLoadOlderMessages={loadOlderMessages}
      onOptimisticSend={handleOptimisticSend}
      onQuickSendGreeting={(message) => {
        void sendTextMessage(message);
      }}
      onRetryMessage={handleRetryMessage}
      onSendFailed={handleSendFailed}
      onSendSucceeded={handleSendSucceeded}
      onToggleReaction={handleToggleReaction}
    />
  );
}
