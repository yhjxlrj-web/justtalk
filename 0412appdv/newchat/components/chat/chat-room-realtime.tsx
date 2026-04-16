"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChatRoom } from "@/components/chat/chat-room";
import { patchCachedChatPreview } from "@/components/home/chat-preview-cache";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import {
  clearCachedRoomEntrySnapshot,
  getCachedRoomEntrySnapshot,
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
import { isChatMessageTooLong } from "@/lib/messages/constants";
import {
  INITIAL_ROOM_MESSAGE_LIMIT,
  OLDER_MESSAGES_PAGE_SIZE,
  UNREAD_CONTEXT_MESSAGE_LIMIT
} from "@/lib/chats/room-loading";
import { formatChatTimestamp } from "@/lib/messages/format";
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

type RoomMessageBatch = {
  firstUnreadMessageId: string | null;
  hasOlderMessages: boolean;
  messages: ChatMessage[];
  otherUserLastSeenAt: string | null;
};

const REACTION_ORDER = ["?ㅿ툘", "?몟", "?ㄳ", "?삲", "?몞", "?솋"] as const;

const QUICK_GREETING_MESSAGE = "안녕하세요 😊";

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftTime - rightTime;
  });
}

function applyReadStatuses(
  messages: ChatMessage[],
  otherUserLastSeenAt: string | null
): ChatMessage[] {
  const orderedMessages = sortMessages(messages);
  const outgoingMessages = orderedMessages.filter(
    (message) => message.direction === "outgoing" && message.deliveryStatus !== "failed"
  );
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
    if (message.direction !== "outgoing" || message.deliveryStatus === "failed") {
      return message.readStatus === null ? message : { ...message, readStatus: null };
    }

    if (message.deliveryStatus === "sending") {
      return message.readStatus === null ? message : { ...message, readStatus: null };
    }

    const currentOutgoingOrder = outgoingOrder.get(message.id);
    let readStatus: ChatMessage["readStatus"] = null;

    if (message.id === lastReadMessageId) {
      readStatus = "read";
    } else if (currentOutgoingOrder !== undefined && currentOutgoingOrder > lastReadOrder) {
      readStatus = "unread";
    }

    const nextDeliveryStatus = message.deliveryStatus ?? "sent";

    if (message.readStatus === readStatus && message.deliveryStatus === nextDeliveryStatus) {
      return message;
    }

    return {
      ...message,
      deliveryStatus: nextDeliveryStatus,
      readStatus
    };
  });
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
  otherUserLastSeenAt: string | null;
}): ChatMessage[] {
  const {
    fetchedMessages,
    translationsByMessageId,
    reactionsByMessageId,
    viewerId,
    otherUserLastSeenAt
  } = params;

  const baseMessages = fetchedMessages.map((message) => {
    const outgoing = message.sender_id === viewerId;
    const translation = translationsByMessageId.get(message.id);
    const displayText = translation?.translated_text ?? message.original_text;

    return {
      id: message.id,
      clientId: message.client_message_id ?? undefined,
      chatRoomId: message.chat_id,
      senderId: message.sender_id,
      direction: outgoing ? "outgoing" : "incoming",
      messageType: (message.message_kind as "text" | "image") ?? "text",
      originalText: message.original_text,
      displayText: outgoing ? message.original_text : displayText,
      body: outgoing ? message.original_text : displayText,
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
      deliveryStatus: outgoing ? ("sent" as const) : undefined,
      readStatus: null,
      reactions: buildReactionSummaries(reactionsByMessageId.get(message.id) ?? [], viewerId)
    } satisfies ChatMessage;
  });

  return applyReadStatuses(baseMessages, otherUserLastSeenAt);
}

function mergeServerMessages(params: {
  current: ChatMessage[];
  serverMessages: ChatMessage[];
  otherUserLastSeenAt: string | null;
}) {
  const { current, serverMessages, otherUserLastSeenAt } = params;
  const serverIds = new Set(serverMessages.map((message) => message.id));
  const serverClientIds = new Set(
    serverMessages.map((message) => message.clientId).filter(Boolean) as string[]
  );
  const unsyncedLocalMessages = current.filter(
    (message) =>
      (message.deliveryStatus === "sending" || message.deliveryStatus === "failed") &&
      !serverIds.has(message.id) &&
      (!message.clientId || !serverClientIds.has(message.clientId))
  );

  return applyReadStatuses([...serverMessages, ...unsyncedLocalMessages], otherUserLastSeenAt);
}

async function hydrateFetchedMessages(params: {
  fetchedMessages: RealtimeMessageRow[];
  otherUserLastSeenAt: string | null;
  supabase: any;
  viewerId: string;
}) {
  const { fetchedMessages, otherUserLastSeenAt, supabase, viewerId } = params;

  if (fetchedMessages.length === 0) {
    return [] as ChatMessage[];
  }

  const messageIds = fetchedMessages.map((message) => message.id);
  let translationsByMessageId = new Map<string, RealtimeTranslationRow>();
  let reactionsByMessageId = new Map<string, RealtimeReactionRow[]>();

  const { data: fetchedTranslations, error: translationsError } = await supabase
    .from("message_translations")
    .select("id, message_id, target_user_id, target_language, translated_text, created_at")
    .in("message_id", messageIds)
    .eq("target_user_id", viewerId);

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

  const { data: fetchedReactions, error: reactionsError } = await supabase
    .from("message_reactions")
    .select("id, message_id, user_id, emoji, created_at")
    .in("message_id", messageIds);

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
    viewerId,
    otherUserLastSeenAt
  });
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
    otherUserLastSeenAt,
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
  otherUserLastSeenAt: string | null;
  roomId: string;
  supabase: any;
  viewerId: string;
}) {
  const { beforeCreatedAt, otherUserLastSeenAt, roomId, supabase, viewerId } = params;

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
    otherUserLastSeenAt,
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
  const messageIdsRef = useRef<Set<string>>(new Set(messages.map((message) => message.id)));
  const pendingOptimisticCommitRef = useRef<{
    messageId: string;
    startedAt: number;
  } | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

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

    patchCachedChatPreview(room.id, (preview) => ({
      ...preview,
      unreadCount: 0,
      viewerLastSeenAt: nowIso
    }));
  }, [room.id, supabase, viewerId]);

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

  const loadInitialRoomState = useCallback(async () => {
    if (hasSeededMessages || preferImmediateEntry) {
      setIsRoomRefreshing(true);
    } else {
      setIsInitialRoomLoading(true);
    }

    try {
      const batch = await fetchInitialRoomMessageBatch({
        roomId: room.id,
        supabase,
        viewerId
      });

      setOtherUserLastSeenAt(batch.otherUserLastSeenAt);
      setInitialScrollTargetMessageId(batch.firstUnreadMessageId);
      setHasResolvedInitialScrollTarget(true);
      setHasOlderMessages(batch.hasOlderMessages);
      setHasRecentMessages(batch.messages.length > 0);
      setMessages((current) =>
        mergeServerMessages({
          current,
          serverMessages: batch.messages,
          otherUserLastSeenAt: batch.otherUserLastSeenAt
        })
      );
      void updateViewerLastSeen();
    } catch (error) {
      console.error("Failed to load initial room state:", error);
      setInitialScrollTargetMessageId(null);
      setHasResolvedInitialScrollTarget(true);
    } finally {
      setIsInitialRoomLoading(false);
      setIsRoomRefreshing(false);
    }
  }, [
    hasSeededMessages,
    preferImmediateEntry,
    room.id,
    supabase,
    updateViewerLastSeen,
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
        otherUserLastSeenAt,
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

        return applyReadStatuses([...uniqueOlderMessages, ...current], otherUserLastSeenAt);
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
    otherUserLastSeenAt,
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
          deliveryStatus: "sending",
          readStatus: null,
          reactions: []
        }
      ]);
    },
    [room.id, viewerId]
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
                deliveryStatus: "sent",
                readStatus: item.readStatus ?? null
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
    [syncChatPreviewCache]
  );

  const handleSendFailed = useCallback((tempId: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === tempId
          ? {
              ...message,
              deliveryStatus: "failed",
              readStatus: null
            }
          : message
      )
      );
  }, []);

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
        senderLanguage: room.myLanguage,
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
    [handleOptimisticSend, handleSendFailed, handleSendSucceeded, locale, room.id, room.myLanguage]
  );

  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      const failedMessage = messages.find((message) => message.id === messageId);

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

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                clientId,
                deliveryStatus: "sending",
                readStatus: null
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
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  deliveryStatus: "failed",
                  readStatus: null
                }
              : message
          )
        );
        return;
      }

      if (!result.message) {
        return;
      }

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
                timestamp: formatChatTimestamp(result.message?.createdAt ?? message.createdAt ?? new Date().toISOString()),
                deliveryStatus: "sent"
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
    [locale, messages, room.id, syncChatPreviewCache]
  );

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const message = messages.find((item) => item.id === messageId);

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
    [messages, refreshReactions, supabase, viewerId]
  );

  useEffect(() => {
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
    recordRecentChatRoom(room.id);
  }, [room.id]);

  useEffect(() => {
    setHasRecentMessages(messages.length > 0);
  }, [messages.length]);

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
    void loadInitialRoomState();
  }, [loadInitialRoomState]);

  useEffect(() => {
    const channel = supabase.channel(`chat-room:${room.id}:${viewerId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${room.id}`
        },
        async (payload) => {
          const row = payload.new as RealtimeMessageRow;

          if (row.sender_id !== viewerId) {
            await updateViewerLastSeen();
          }

          setMessages((current) => {
            if (current.some((message) => message.id === row.id)) {
              return applyReadStatuses(current, otherUserLastSeenAt);
            }

            const matchingTemp =
              row.client_message_id != null
                ? current.find(
                    (message) =>
                      message.deliveryStatus === "sending" &&
                      message.direction === "outgoing" &&
                      message.clientId === row.client_message_id
                  )
                : undefined;

            let nextMessages = current;

            if (matchingTemp) {
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
                        row.attachment_content_type ?? message.attachmentContentType,
                      deliveryStatus: "sent"
                    }
                  : message
              );
            } else {
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
                  displayText: row.original_text,
                  body: row.original_text,
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
                  deliveryStatus: row.sender_id === viewerId ? "sent" : undefined,
                  readStatus: null,
                  reactions: []
                }
              ];
            }

            return applyReadStatuses(nextMessages, otherUserLastSeenAt);
          });

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

          setMessages((current) =>
            current.map((message) =>
              message.id === row.message_id && message.direction === "incoming"
                ? {
                    ...message,
                    displayText: row.translated_text,
                    body: row.translated_text,
                    targetLanguage: row.target_language,
                    language: row.target_language
                  }
                : message
            )
          );
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

          setOtherUserLastSeenAt(updatedRow.last_seen_at);
          setMessages((current) => applyReadStatuses(current, updatedRow.last_seen_at));
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionState("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionState("reconnecting");
        } else {
          setConnectionState("connecting");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    otherUserLastSeenAt,
    refreshReactions,
    room.id,
    syncChatPreviewCache,
    supabase,
    updateViewerLastSeen,
    viewerId
  ]);

  return (
    <ChatRoom
      room={room}
      messages={messages}
      connectionState={connectionState}
      hasOlderMessages={hasOlderMessages}
      hasRecentMessages={hasRecentMessages}
      hasResolvedInitialScrollTarget={hasResolvedInitialScrollTarget}
      initialScrollTargetMessageId={initialScrollTargetMessageId}
      isInitialRoomLoading={isInitialRoomLoading}
      isOlderMessagesLoading={isOlderMessagesLoading}
      isRoomRefreshing={isRoomRefreshing}
      suppressInitialSkeleton={preferImmediateEntry}
      onDeleteHistory={() => {
        clearCachedRoomMessages(room.id);
        clearCachedRoomEntrySnapshot(room.id);
        setMessages([]);
        setHasOlderMessages(false);
        setHasRecentMessages(false);
      }}
      onLoadOlderMessages={loadOlderMessages}
      onOptimisticSend={handleOptimisticSend}
      onQuickSendGreeting={() => {
        void sendTextMessage(QUICK_GREETING_MESSAGE);
      }}
      onRetryMessage={handleRetryMessage}
      onSendFailed={handleSendFailed}
      onSendSucceeded={handleSendSucceeded}
      onToggleReaction={handleToggleReaction}
    />
  );
}
