"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  preloadTopChatRooms,
  preloadUnreadChatRooms
} from "@/components/chat/room-preloader";
import {
  filterChatPreviewsByBlockedPeerIds,
  getCachedChatPreviews,
  mergeChatPreviews,
  setCachedChatPreviews,
  subscribeChatPreviewCache
} from "@/components/home/chat-preview-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatChatTimestamp } from "@/lib/messages/format";
import { ChatList } from "@/components/home/chat-list";
import type { ChatRoomPreview } from "@/types/home";

type RealtimeMessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  original_text: string;
  original_language: string;
  created_at: string;
  message_kind?: "text" | "image" | null;
};

type RealtimeTranslationRow = {
  id: string;
  message_id: string;
  target_user_id: string;
  target_language: string;
  translated_text: string;
  created_at: string;
};

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
    return filterChatPreviewsByBlockedPeerIds(cachedOrInitial, blockedPeerUserIds).filteredPreviews;
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

          const nextChats = moved ? [moved, ...rest] : updated;
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
            const nextChats = current.map((chat) =>
            chat.lastMessageId === row.message_id
              ? {
                  ...chat,
                  latestMessagePreview: row.translated_text
                }
              : chat
            );
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
  }, [blockedPeerIdSet, selectedRoomId, supabase, viewerId]);

  return <ChatList chats={chats} selectedRoomId={selectedRoomId} connectionState={isConnecting ? "connecting" : "connected"} />;
}
