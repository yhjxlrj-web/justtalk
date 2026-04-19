"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatRoom } from "@/components/chat/chat-room";
import { patchCachedChatPreview } from "@/components/home/chat-preview-cache";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import {
  clearCachedRoomEntrySnapshot,
  getCachedRoomEntrySnapshot,
  setCachedRoomEntrySnapshot
} from "@/components/chat/room-entry-cache";
import {
  clearCachedRoomMessages,
  getCachedRoomMessages,
  setCachedRoomMessages
} from "@/components/chat/room-message-cache";
import { getChatRoomSummaryAction } from "@/lib/chats/actions";
import { fetchRoomMessages } from "@/lib/chat/fetch-room-messages";
import {
  applyOutgoingReadState,
  dedupeRoomMessagesById,
  mergeServerMessagesWithPending,
  sortRoomMessagesStable
} from "@/lib/chat/merge-room-messages";
import { useRoomPolling } from "@/lib/chat/use-room-polling";
import {
  type RealtimeChannelStatus,
  type RealtimeInsertMessageRow,
  type RealtimeParticipantUpdateRow,
  type RealtimeTranslationInsertRow,
  useRoomRealtime
} from "@/lib/chat/use-room-realtime";
import { initialSendMessageFormState } from "@/lib/messages/action-state";
import { sendMessageAction } from "@/lib/messages/actions";
import { formatChatTimestamp } from "@/lib/messages/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatMessage, ChatRoomSummary } from "@/types/chat";

const ROOM_POLLING_INTERVAL_MS = 2500;
const ROOM_READ_MARK_INTERVAL_MS = 2500;
const ROOM_READ_MARK_THROTTLE_MS = 1200;

type SendSucceededMessage = {
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
};

function createClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mapRealtimeInsertToMessage(row: RealtimeInsertMessageRow, viewerId: string): ChatMessage {
  const outgoing = row.sender_id === viewerId;
  const messageType = row.message_kind ?? "text";
  const displayBody = row.original_text;
  const translationPending = !outgoing && messageType === "text";

  return {
    id: row.id,
    clientId: row.client_message_id ?? undefined,
    chatRoomId: row.chat_id,
    senderId: row.sender_id,
    direction: outgoing ? "outgoing" : "incoming",
    messageType,
    originalText: row.original_text,
    displayText: displayBody,
    body: displayBody,
    originalBody: outgoing ? undefined : row.original_text,
    senderLanguage: row.original_language,
    targetLanguage: row.original_language,
    language: row.original_language,
    timestamp: formatChatTimestamp(row.created_at),
    createdAt: row.created_at,
    imageUrl: row.attachment_url ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    attachmentContentType: row.attachment_content_type ?? undefined,
    canRetry: outgoing,
    deliveryStatus: outgoing ? "sent" : undefined,
    readStatus: null,
    translationPending,
    reactions: []
  };
}

function mapSendSucceededToMessage(message: SendSucceededMessage, viewerId: string, roomId: string): ChatMessage {
  const messageType = message.messageType ?? "text";
  const displayBody = message.originalText;

  return {
    id: message.id,
    clientId: message.clientId,
    chatRoomId: roomId,
    senderId: viewerId,
    direction: "outgoing",
    messageType,
    originalText: message.originalText,
    displayText: displayBody,
    body: displayBody,
    senderLanguage: message.originalLanguage,
    targetLanguage: message.targetLanguage ?? message.originalLanguage,
    language: message.targetLanguage ?? message.originalLanguage,
    timestamp: formatChatTimestamp(message.createdAt),
    createdAt: message.createdAt,
    imageUrl: message.imageUrl,
    attachmentName: message.attachmentName,
    attachmentContentType: message.attachmentContentType,
    canRetry: true,
    deliveryStatus: "sent",
    readStatus: "unread",
    translationPending: false,
    reactions: []
  };
}

function mapOptimisticMessageToChatMessage(params: {
  roomId: string;
  viewerId: string;
  message: {
    id: string;
    clientId: string;
    body: string;
    originalText: string;
    attachmentContentType?: string;
    attachmentName?: string;
    imageUrl?: string;
    messageType?: "text" | "image";
    senderLanguage?: string;
    createdAt: string;
  };
}): ChatMessage {
  const { roomId, viewerId, message } = params;
  const messageType = message.messageType ?? "text";
  const senderLanguage = message.senderLanguage ?? "en";

  return {
    id: message.id,
    clientId: message.clientId,
    chatRoomId: roomId,
    senderId: viewerId,
    direction: "outgoing",
    messageType,
    originalText: message.originalText,
    displayText: message.body,
    body: message.body,
    senderLanguage,
    targetLanguage: senderLanguage,
    language: senderLanguage,
    timestamp: formatChatTimestamp(message.createdAt),
    createdAt: message.createdAt,
    imageUrl: message.imageUrl,
    attachmentName: message.attachmentName,
    attachmentContentType: message.attachmentContentType,
    canRetry: true,
    deliveryStatus: "sending",
    readStatus: null,
    translationPending: false,
    reactions: []
  };
}

function getMessagePreviewText(message: ChatMessage) {
  if (message.messageType === "image") {
    return message.attachmentName || message.originalText || "Photo";
  }

  return message.originalText || message.body;
}

function syncPreviewCache(roomId: string, message: ChatMessage) {
  const createdAt = message.createdAt ?? new Date().toISOString();

  patchCachedChatPreview(
    roomId,
    (preview) => ({
      ...preview,
      latestMessagePreview: getMessagePreviewText(message),
      latestMessageCreatedAt: createdAt,
      latestMessageAt: formatChatTimestamp(createdAt),
      lastMessageId: message.id,
      unreadCount: 0
    }),
    { moveToFront: true }
  );
}

export function ChatRoomRealtime({
  initialMessages,
  room,
  viewerId
}: {
  room: ChatRoomSummary;
  initialMessages: ChatMessage[];
  preferImmediateEntry?: boolean;
  viewerId: string;
}) {
  const locale = useCurrentLocale();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const cachedRoomEntrySnapshot = getCachedRoomEntrySnapshot(room.id);
  const cachedMessages = getCachedRoomMessages(room.id) ?? cachedRoomEntrySnapshot?.messages ?? null;
  const seededMessages = cachedMessages ?? initialMessages;
  const sortedSeededMessages = useMemo(() => {
    const sortedMessages = sortRoomMessagesStable(seededMessages);
    return applyOutgoingReadState(sortedMessages, cachedRoomEntrySnapshot?.otherUserLastSeenAt ?? null);
  }, [cachedRoomEntrySnapshot?.otherUserLastSeenAt, seededMessages]);

  const [roomState, setRoomState] = useState(room);
  const [messages, setMessages] = useState<ChatMessage[]>(sortedSeededMessages);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "reconnecting">(
    "connecting"
  );
  const [hasOlderMessages, setHasOlderMessages] = useState(
    cachedRoomEntrySnapshot?.hasOlderMessages ?? false
  );
  const [hasRecentMessages, setHasRecentMessages] = useState(sortedSeededMessages.length > 0);
  const [isInitialRoomLoading, setIsInitialRoomLoading] = useState(sortedSeededMessages.length === 0);
  const [isRoomRefreshing, setIsRoomRefreshing] = useState(false);
  const [otherUserLastSeenAt, setOtherUserLastSeenAt] = useState<string | null>(
    cachedRoomEntrySnapshot?.otherUserLastSeenAt ?? null
  );
  const [hasResolvedInitialScrollTarget, setHasResolvedInitialScrollTarget] = useState(
    sortedSeededMessages.length > 0
  );
  const [initialScrollTargetMessageId, setInitialScrollTargetMessageId] = useState<string | null>(
    cachedRoomEntrySnapshot?.initialScrollTargetMessageId ?? null
  );

  const messagesRef = useRef(messages);
  const otherUserLastSeenAtRef = useRef(otherUserLastSeenAt);
  const lastReadMarkAtRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
    setCachedRoomMessages(room.id, messages);
    setCachedRoomEntrySnapshot(room.id, {
      initialScrollTargetMessageId,
      messages,
      hasOlderMessages,
      otherUserLastSeenAt,
      preloadedAt: Date.now()
    });
  }, [hasOlderMessages, initialScrollTargetMessageId, messages, otherUserLastSeenAt, room.id]);

  useEffect(() => {
    otherUserLastSeenAtRef.current = otherUserLastSeenAt;
  }, [otherUserLastSeenAt]);

  useEffect(() => {
    console.log("[chat-room] chat-room mounted", { roomId: room.id, viewerId });
    return () => {
      console.log("[chat-room] chat-room unmounted", { roomId: room.id, viewerId });
    };
  }, [room.id, viewerId]);

  useEffect(() => {
    let isDisposed = false;

    const refreshRoomSummary = async () => {
      const summary = await getChatRoomSummaryAction(room.id);

      if (!isDisposed && summary.room) {
        setRoomState(summary.room);
      }
    };

    void refreshRoomSummary();

    return () => {
      isDisposed = true;
    };
  }, [room.id]);

  const markRoomAsRead = useCallback(
    async (reason: string) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      const now = Date.now();

      if (now - lastReadMarkAtRef.current < ROOM_READ_MARK_THROTTLE_MS) {
        return;
      }

      lastReadMarkAtRef.current = now;
      const lastSeenAt = new Date(now).toISOString();

      const { error } = await supabase
        .from("chat_participants")
        .update({ last_seen_at: lastSeenAt })
        .eq("chat_id", room.id)
        .eq("user_id", viewerId);

      if (error) {
        console.error("[chat-room] read mark error", {
          roomId: room.id,
          viewerId,
          reason,
          error
        });
        return;
      }

      console.log("[chat-room] read mark success", {
        roomId: room.id,
        viewerId,
        reason,
        lastSeenAt
      });
    },
    [room.id, supabase, viewerId]
  );

  useEffect(() => {
    void markRoomAsRead("mount");

    const intervalHandle = window.setInterval(() => {
      void markRoomAsRead("interval");
    }, ROOM_READ_MARK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [markRoomAsRead]);

  const pollRoomMessages = useCallback(
    async (reason: "initial" | "interval" | "visibility") => {
      const shouldShowInitialLoading = reason === "initial" && messagesRef.current.length === 0;

      if (shouldShowInitialLoading) {
        setIsInitialRoomLoading(true);
      } else {
        setIsRoomRefreshing(true);
      }

      try {
        const fetched = await fetchRoomMessages({
          roomId: room.id,
          supabase,
          viewerId
        });

        setMessages((current) => {
          const mergedMessages = mergeServerMessagesWithPending(fetched.messages, current);
          const next = applyOutgoingReadState(mergedMessages, fetched.otherUserLastSeenAt);
          setHasRecentMessages(next.length > 0);
          return next;
        });

        setOtherUserLastSeenAt(fetched.otherUserLastSeenAt);
        setHasOlderMessages(fetched.hasOlderMessages);
        setInitialScrollTargetMessageId(null);
        setHasResolvedInitialScrollTarget(true);
        setConnectionState("connected");

        console.log("[chat-room] polling fetch success", {
          roomId: room.id,
          reason,
          fetchedCount: fetched.messages.length
        });

        void markRoomAsRead("poll-success");
      } catch (error) {
        setConnectionState("reconnecting");
        console.error("[chat-room] polling fetch error", {
          roomId: room.id,
          reason,
          error
        });
      } finally {
        setIsInitialRoomLoading(false);
        setIsRoomRefreshing(false);
      }
    },
    [markRoomAsRead, room.id, supabase, viewerId]
  );

  useRoomPolling({
    enabled: true,
    intervalMs: ROOM_POLLING_INTERVAL_MS,
    roomId: room.id,
    onPoll: pollRoomMessages
  });

  const handleRealtimeInsert = useCallback(
    (row: RealtimeInsertMessageRow) => {
      if (row.chat_id !== room.id) {
        console.log("[chat-room] dedupe skipped reason", {
          roomId: room.id,
          messageId: row.id,
          senderId: row.sender_id,
          reason: "room-mismatch"
        });
        return;
      }

      const incomingMessage = mapRealtimeInsertToMessage(row, viewerId);

      setMessages((current) => {
        if (current.some((message) => message.id === incomingMessage.id)) {
          console.log("[chat-room] dedupe skipped reason", {
            roomId: room.id,
            messageId: incomingMessage.id,
            senderId: incomingMessage.senderId,
            reason: "duplicate-id"
          });
          return current;
        }

        const matchedSendingMessage =
          incomingMessage.clientId != null
            ? current.find(
                (message) =>
                  message.direction === "outgoing" &&
                  message.deliveryStatus === "sending" &&
                  message.clientId === incomingMessage.clientId
              )
            : undefined;

        const nextMessages = matchedSendingMessage
          ? current.map((message) =>
              message.id === matchedSendingMessage.id ? incomingMessage : message
            )
          : dedupeRoomMessagesById([...current, incomingMessage]);
        const withReadState = applyOutgoingReadState(nextMessages, otherUserLastSeenAtRef.current);

        console.log("[chat-room] setMessages append executed", {
          roomId: room.id,
          messageId: incomingMessage.id,
          senderId: incomingMessage.senderId,
          mode: matchedSendingMessage ? "replace-sending" : "append"
        });

        setHasRecentMessages(withReadState.length > 0);
        return withReadState;
      });

      syncPreviewCache(room.id, incomingMessage);

      if (row.sender_id !== viewerId) {
        void markRoomAsRead("incoming-realtime");
      }
    },
    [markRoomAsRead, room.id, viewerId]
  );

  const handleParticipantUpdate = useCallback(
    (row: RealtimeParticipantUpdateRow) => {
      if (row.user_id === viewerId) {
        return;
      }

      setOtherUserLastSeenAt(row.last_seen_at);
      setMessages((current) => {
        const next = applyOutgoingReadState(current, row.last_seen_at);
        console.log("[chat-room] setMessages append executed", {
          roomId: room.id,
          messageId: null,
          senderId: row.user_id,
          mode: "read-status-patch"
        });
        return next;
      });
    },
    [room.id, viewerId]
  );

  const handleTranslationInsert = useCallback(
    (row: RealtimeTranslationInsertRow) => {
      setMessages((current) => {
        let didPatch = false;

        const next = current.map((message) => {
          if (message.id !== row.message_id || message.direction !== "incoming") {
            return message;
          }

          didPatch = true;
          return {
            ...message,
            displayText: row.translated_text,
            body: row.translated_text,
            targetLanguage: row.target_language,
            language: row.target_language,
            translationPending: false
          };
        });

        if (!didPatch) {
          console.log("[chat-room] dedupe skipped reason", {
            roomId: room.id,
            messageId: row.message_id,
            senderId: null,
            reason: "translation-target-not-found"
          });
          return current;
        }

        console.log("[chat-room] setMessages append executed", {
          roomId: room.id,
          messageId: row.message_id,
          senderId: null,
          mode: "translation-patch"
        });

        return next;
      });
    },
    [room.id]
  );

  const handleRealtimeStatusChange = useCallback((status: RealtimeChannelStatus) => {
    if (status === "SUBSCRIBED") {
      setConnectionState("connected");
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      setConnectionState("reconnecting");
      return;
    }

    if (status === "CLOSED") {
      setConnectionState("connecting");
    }
  }, []);

  useRoomRealtime({
    enabled: true,
    roomId: room.id,
    supabase,
    viewerId,
    onInsert: handleRealtimeInsert,
    onParticipantUpdate: handleParticipantUpdate,
    onTranslationInsert: handleTranslationInsert,
    onStatusChange: handleRealtimeStatusChange
  });

  const handleOptimisticSend = useCallback(
    (message: {
      id: string;
      clientId: string;
      body: string;
      originalText: string;
      attachmentContentType?: string;
      attachmentName?: string;
      imageUrl?: string;
      messageType?: "text" | "image";
      senderLanguage?: string;
      createdAt: string;
    }) => {
      const optimisticMessage = mapOptimisticMessageToChatMessage({
        roomId: room.id,
        viewerId,
        message
      });

      setMessages((current) => {
        const mergedMessages = dedupeRoomMessagesById([...current, optimisticMessage]);
        const nextMessages = applyOutgoingReadState(mergedMessages, otherUserLastSeenAtRef.current);
        setHasRecentMessages(nextMessages.length > 0);
        return nextMessages;
      });

      syncPreviewCache(room.id, optimisticMessage);
    },
    [room.id, viewerId]
  );

  const handleSendFailed = useCallback((tempId: string) => {
    setMessages((current) =>
      applyOutgoingReadState(
        current.map((message) =>
          message.id === tempId
            ? {
                ...message,
                deliveryStatus: "failed",
                canRetry: true
              }
            : message
        ),
        otherUserLastSeenAtRef.current
      )
    );
  }, []);

  const handleSendSucceeded = useCallback(
    (tempId: string, message: SendSucceededMessage) => {
      const resolvedMessage = mapSendSucceededToMessage(message, viewerId, room.id);

      setMessages((current) => {
        const replacedMessages = current.map((item) =>
          item.id === tempId ? resolvedMessage : item
        );
        const hasTemp = current.some((item) => item.id === tempId);
        const merged = hasTemp
          ? dedupeRoomMessagesById(replacedMessages)
          : dedupeRoomMessagesById([...replacedMessages, resolvedMessage]);
        const withReadState = applyOutgoingReadState(merged, otherUserLastSeenAtRef.current);
        setHasRecentMessages(withReadState.length > 0);
        return withReadState;
      });

      syncPreviewCache(room.id, resolvedMessage);
    },
    [room.id, viewerId]
  );

  const sendTextMessage = useCallback(
    async (rawMessage: string, retryMessageId?: string) => {
      const normalizedMessage = rawMessage.trim();

      if (!normalizedMessage) {
        return;
      }

      const clientId = createClientMessageId();
      const fallbackTempId = `temp-${clientId}`;
      const tempId = retryMessageId ?? fallbackTempId;

      if (retryMessageId) {
        setMessages((current) =>
          current.map((message) =>
            message.id === retryMessageId
              ? {
                  ...message,
                  clientId,
                  body: normalizedMessage,
                  originalText: normalizedMessage,
                  displayText: normalizedMessage,
                  deliveryStatus: "sending",
                  canRetry: true
                }
              : message
          )
        );
      } else {
        handleOptimisticSend({
          id: tempId,
          clientId,
          body: normalizedMessage,
          originalText: normalizedMessage,
          createdAt: new Date().toISOString(),
          senderLanguage: roomState.myLanguage
        });
      }

      const formData = new FormData();
      formData.set("chatId", room.id);
      formData.set("clientMessageId", clientId);
      formData.set("message", normalizedMessage);
      formData.set("locale", locale);

      const result = await sendMessageAction(initialSendMessageFormState, formData);

      if (result.error || !result.message) {
        handleSendFailed(tempId);
        return;
      }

      handleSendSucceeded(tempId, result.message);
    },
    [handleOptimisticSend, handleSendFailed, handleSendSucceeded, locale, room.id, roomState.myLanguage]
  );

  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      const failedMessage = messagesRef.current.find((message) => message.id === messageId);

      if (!failedMessage) {
        return;
      }

      const retryBody = failedMessage.originalText ?? failedMessage.body;
      await sendTextMessage(retryBody, messageId);
    },
    [sendTextMessage]
  );

  const handleDeleteHistory = useCallback(() => {
    clearCachedRoomMessages(room.id);
    clearCachedRoomEntrySnapshot(room.id);
    setMessages([]);
    setHasOlderMessages(false);
    setHasRecentMessages(false);
  }, [room.id]);

  return (
    <ChatRoom
      room={roomState}
      messages={messages}
      messageStatusMap={{}}
      connectionState={connectionState}
      hasOlderMessages={hasOlderMessages}
      hasRecentMessages={hasRecentMessages}
      hasResolvedInitialScrollTarget={hasResolvedInitialScrollTarget}
      initialScrollTargetMessageId={initialScrollTargetMessageId}
      isInitialRoomLoading={isInitialRoomLoading}
      isOlderMessagesLoading={false}
      isRoomRefreshing={isRoomRefreshing}
      onDeleteHistory={handleDeleteHistory}
      onOptimisticSend={handleOptimisticSend}
      onQuickSendGreeting={(message) => {
        void sendTextMessage(message);
      }}
      onRetryMessage={handleRetryMessage}
      onSendFailed={handleSendFailed}
      onSendSucceeded={handleSendSucceeded}
    />
  );
}
