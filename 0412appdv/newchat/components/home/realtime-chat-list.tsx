"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  prewarmChatRoom,
  preloadTopChatRooms,
  preloadUnreadChatRooms
} from "@/components/chat/room-preloader";
import { patchCachedRoomEntrySnapshot } from "@/components/chat/room-entry-cache";
import { patchCachedRoomMessages } from "@/components/chat/room-message-cache";
import {
  filterChatPreviewsByBlockedPeerIds,
  getCachedChatPreviews,
  mergeChatPreviews,
  normalizeUnreadCountForPreview,
  setCachedChatPreviews,
  subscribeChatPreviewCache
} from "@/components/home/chat-preview-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatChatTimestamp } from "@/lib/messages/format";
import { ChatList } from "@/components/home/chat-list";
import type { ChatMessage } from "@/types/chat";
import type { ChatRoomPreview } from "@/types/home";

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

type RealtimeParticipantUpdateRow = {
  chat_id: string;
  user_id: string;
  last_seen_at: string | null;
  last_read_message_id?: string | null;
};

type RealtimeSummaryUpdateRow = {
  room_id: string;
  user_id: string;
  last_message_id?: string | null;
  last_message_preview?: string | null;
  last_message_created_at?: string | null;
  unread_count?: number | null;
};

const ROOM_MESSAGE_PREWARM_LIMIT = 80;
const PENDING_TRANSLATION_PLACEHOLDER = "Translating...";

function toMessageTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function mergeRealtimeMessageIntoCache(
  currentMessages: ChatMessage[] | null,
  nextMessage: ChatMessage
) {
  const safeCurrentMessages = currentMessages ?? [];
  const nextMessageClientId = nextMessage.clientId ?? null;
  const existingMessageIndex = safeCurrentMessages.findIndex(
    (message) =>
      message.id === nextMessage.id ||
      (nextMessageClientId !== null && message.clientId === nextMessageClientId)
  );

  const mergedMessages =
    existingMessageIndex >= 0
      ? safeCurrentMessages.map((message, index) =>
          index === existingMessageIndex
            ? {
                ...message,
                ...nextMessage
              }
            : message
        )
      : [...safeCurrentMessages, nextMessage];

  return mergedMessages
    .sort((left, right) => toMessageTimestamp(left.createdAt) - toMessageTimestamp(right.createdAt))
    .slice(-ROOM_MESSAGE_PREWARM_LIMIT);
}

function mapRealtimeMessageToCachedMessage(row: RealtimeMessageRow, viewerId: string): ChatMessage {
  const isOutgoing = row.sender_id === viewerId;
  const isImageMessage = row.message_kind === "image";
  const originalText = row.original_text ?? "";
  const incomingDisplayText = isImageMessage ? originalText : PENDING_TRANSLATION_PLACEHOLDER;

  return {
    id: row.id,
    clientId: row.client_message_id ?? undefined,
    chatRoomId: row.chat_id,
    senderId: row.sender_id,
    direction: isOutgoing ? "outgoing" : "incoming",
    messageType: isImageMessage ? "image" : "text",
    originalText,
    displayText: isOutgoing ? originalText : incomingDisplayText,
    body: isOutgoing ? originalText : incomingDisplayText,
    originalBody: isOutgoing ? undefined : originalText,
    senderLanguage: row.original_language,
    targetLanguage: row.original_language,
    language: row.original_language,
    timestamp: formatChatTimestamp(row.created_at),
    createdAt: row.created_at,
    imageUrl: row.attachment_url ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    attachmentContentType: row.attachment_content_type ?? undefined,
    canRetry: isOutgoing,
    reactions: []
  };
}

function patchRoomCachesFromRealtimeMessage(row: RealtimeMessageRow, viewerId: string) {
  const mappedMessage = mapRealtimeMessageToCachedMessage(row, viewerId);

  patchCachedRoomMessages(row.chat_id, (currentMessages) =>
    mergeRealtimeMessageIntoCache(currentMessages, mappedMessage)
  );

  patchCachedRoomEntrySnapshot(row.chat_id, (currentSnapshot) => {
    if (!currentSnapshot) {
      return currentSnapshot;
    }

    return {
      ...currentSnapshot,
      messages: mergeRealtimeMessageIntoCache(currentSnapshot.messages, mappedMessage),
      preloadedAt: Date.now()
    };
  });
}

function patchRoomCachesFromRealtimeTranslation(params: {
  roomId: string;
  translation: RealtimeTranslationRow;
}) {
  const { roomId, translation } = params;

  patchCachedRoomMessages(roomId, (currentMessages) => {
    if (!currentMessages?.length) {
      return currentMessages;
    }

    return currentMessages.map((message) =>
      message.id === translation.message_id && message.direction === "incoming"
        ? {
            ...message,
            displayText: translation.translated_text,
            body: translation.translated_text,
            targetLanguage: translation.target_language,
            language: translation.target_language
          }
        : message
    );
  });

  patchCachedRoomEntrySnapshot(roomId, (currentSnapshot) => {
    if (!currentSnapshot) {
      return currentSnapshot;
    }

    return {
      ...currentSnapshot,
      messages: currentSnapshot.messages.map((message) =>
        message.id === translation.message_id && message.direction === "incoming"
          ? {
              ...message,
              displayText: translation.translated_text,
              body: translation.translated_text,
              targetLanguage: translation.target_language,
              language: translation.target_language
            }
          : message
      ),
      preloadedAt: Date.now()
    };
  });
}

export function RealtimeChatList({
  initialChats,
  blockedPeerUserIds,
  isVisible = false,
  selectedRoomId,
  viewerId
}: {
  initialChats: ChatRoomPreview[];
  blockedPeerUserIds: string[];
  isVisible?: boolean;
  selectedRoomId?: string;
  viewerId: string;
}) {
  const [chats, setChats] = useState(() => {
    const cachedOrInitial = getCachedChatPreviews() ?? initialChats;
    return filterChatPreviewsByBlockedPeerIds(cachedOrInitial, blockedPeerUserIds).filteredPreviews.map(
      (chat) => normalizeUnreadCountForPreview(chat)
    );
  });
  const [isConnecting, setIsConnecting] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const blockedPeerIdSet = useMemo(() => new Set(blockedPeerUserIds), [blockedPeerUserIds]);

  useEffect(() => {
    const cachedPreviews = getCachedChatPreviews();
    const mergedPreviews = mergeChatPreviews(cachedPreviews, initialChats, blockedPeerUserIds, {
      pruneMissingIncomingRooms: true
    });

    console.log("realtimeChatList hydrate merge", {
      viewerId,
      blockedPeerUserIds,
      cachedPreviewSnapshot:
        cachedPreviews?.map((preview) => ({
          roomId: preview.roomId,
          latestMessagePreview: preview.latestMessagePreview,
          latestMessageCreatedAt: preview.latestMessageCreatedAt
        })) ?? [],
      incomingPreviewSnapshot: initialChats.map((preview) => ({
        roomId: preview.roomId,
        latestMessagePreview: preview.latestMessagePreview,
        latestMessageCreatedAt: preview.latestMessageCreatedAt
      })),
      mergedPreviewSnapshot: mergedPreviews.map((preview) => ({
        roomId: preview.roomId,
        latestMessagePreview: preview.latestMessagePreview,
        latestMessageCreatedAt: preview.latestMessageCreatedAt
      }))
    });

    setChats(mergedPreviews);
    setCachedChatPreviews(mergedPreviews);
  }, [blockedPeerUserIds, initialChats, viewerId]);

  useEffect(() => {
    setChats((current) => {
      const { filteredPreviews, blockedRoomIds } = filterChatPreviewsByBlockedPeerIds(
        current,
        blockedPeerUserIds
      );

      if (blockedRoomIds.length > 0) {
        console.log("realtimeChatList prune blocked previews", {
          viewerId,
          blockedPeerUserIds,
          blockedRoomIds
        });
        setCachedChatPreviews(filteredPreviews);
      }

      return filteredPreviews;
    });
  }, [blockedPeerUserIds, viewerId]);

  useEffect(() => subscribeChatPreviewCache(setChats), []);

  useEffect(() => {
    if (chats.length === 0) {
      return;
    }

    let cancelled = false;

    preloadUnreadChatRooms({
      chats,
      router,
      shouldContinue: () => !cancelled,
      supabase,
      viewerId
    });

    return () => {
      cancelled = true;
    };
  }, [chats, router, supabase, viewerId]);

  useEffect(() => {
    if (!isVisible || chats.length === 0) {
      return;
    }

    let cancelled = false;

    preloadTopChatRooms({
      chats,
      router,
      shouldContinue: () => !cancelled,
      supabase,
      viewerId
    });

    return () => {
      cancelled = true;
    };
  }, [chats, isVisible, router, supabase, viewerId]);

  useEffect(() => {
    const channel = supabase.channel(`chat-list:${viewerId}`);

    channel
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages"
      }, (payload) => {
        const row = payload.new as RealtimeMessageRow;

        setChats((current) => {
          const existing = current.find((chat) => chat.roomId === row.chat_id);
          const peerUserId = existing?.peerUserId ?? null;
          const isBlockedByViewer = !!peerUserId && blockedPeerIdSet.has(peerUserId);

          console.log("realtime preview patch candidate", {
            viewerId,
            roomId: row.chat_id,
            peerUserId,
            senderId: row.sender_id,
            isBlockedByViewer
          });

          if (!existing || isBlockedByViewer) {
            return current;
          }

          const preview = row.message_kind === "image" ? "Photo" : row.original_text;

          const updated = current.map((chat) =>
            chat.roomId === row.chat_id
              ? {
                  ...chat,
                  latestMessagePreview: preview,
                  latestMessageAt: formatChatTimestamp(row.created_at),
                  latestMessageCreatedAt: row.created_at,
                  lastMessageId: row.id,
                  unreadCount:
                    row.sender_id === viewerId
                      ? chat.unreadCount ?? 0
                      : (chat.unreadCount ?? 0) + 1,
                  selected: chat.roomId === selectedRoomId
                }
              : chat
          );

          const moved = updated.find((chat) => chat.roomId === row.chat_id);
          const rest = updated.filter((chat) => chat.roomId !== row.chat_id);

          const nextChats = (moved ? [moved, ...rest] : updated).map((chat) =>
            normalizeUnreadCountForPreview(chat)
          );
          setCachedChatPreviews(nextChats);
          return nextChats;
        });

        patchRoomCachesFromRealtimeMessage(row, viewerId);

        void prewarmChatRoom({
          roomId: row.chat_id,
          router,
          supabase,
          viewerId
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_participants",
        filter: `user_id=eq.${viewerId}`
      }, (payload) => {
        const row = payload.new as RealtimeParticipantUpdateRow;

        setChats((current) => {
          const nextChats = current.map((chat) =>
            chat.roomId === row.chat_id
              ? normalizeUnreadCountForPreview({
                  ...chat,
                  viewerLastSeenAt: row.last_seen_at ?? undefined
                })
              : chat
          );

          setCachedChatPreviews(nextChats);
          return nextChats;
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_room_summaries",
        filter: `user_id=eq.${viewerId}`
      }, (payload) => {
        const row = payload.new as RealtimeSummaryUpdateRow;

        setChats((current) => {
          const nextChats = current.map((chat) =>
            chat.roomId === row.room_id
              ? normalizeUnreadCountForPreview({
                  ...chat,
                  latestMessagePreview: row.last_message_preview?.trim() || chat.latestMessagePreview,
                  latestMessageCreatedAt:
                    row.last_message_created_at ?? chat.latestMessageCreatedAt,
                  latestMessageAt: row.last_message_created_at
                    ? formatChatTimestamp(row.last_message_created_at)
                    : chat.latestMessageAt,
                  lastMessageId: row.last_message_id ?? chat.lastMessageId,
                  unreadCount: Math.max(0, row.unread_count ?? chat.unreadCount ?? 0)
                })
              : chat
          );

          setCachedChatPreviews(nextChats);
          return nextChats;
        });
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "message_translations",
        filter: `target_user_id=eq.${viewerId}`
      }, (payload) => {
        const row = payload.new as RealtimeTranslationRow;

        setChats((current) =>
          {
            let translatedRoomId: string | null = null;
            const nextChats = current.map((chat) => {
              if (chat.lastMessageId !== row.message_id) {
                return chat;
              }

              translatedRoomId = chat.roomId;
              return {
                ...chat,
                latestMessagePreview: row.translated_text
              };
            });

            if (translatedRoomId) {
              patchRoomCachesFromRealtimeTranslation({
                roomId: translatedRoomId,
                translation: row
              });
            }

            setCachedChatPreviews(nextChats);
            return nextChats;
          }
        );
      })
      .subscribe((status) => {
        setIsConnecting(status !== "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [blockedPeerIdSet, router, selectedRoomId, supabase, viewerId]);

  return <ChatList chats={chats} selectedRoomId={selectedRoomId} connectionState={isConnecting ? "connecting" : "connected"} />;
}
