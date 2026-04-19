"use client";

import { useEffect } from "react";

export type RealtimeInsertMessageRow = {
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

export type RealtimeParticipantUpdateRow = {
  chat_id: string;
  user_id: string;
  last_seen_at: string | null;
};

export type RealtimeTranslationInsertRow = {
  message_id: string;
  translated_text: string;
  target_language: string;
  target_user_id: string;
};

export type RealtimeChannelStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED"
  | "JOINING"
  | "LEAVING"
  | string;

export function useRoomRealtime(params: {
  enabled: boolean;
  roomId: string;
  supabase: any;
  viewerId: string;
  onInsert: (row: RealtimeInsertMessageRow) => void;
  onParticipantUpdate?: (row: RealtimeParticipantUpdateRow) => void;
  onTranslationInsert?: (row: RealtimeTranslationInsertRow) => void;
  onStatusChange?: (status: RealtimeChannelStatus) => void;
}) {
  const {
    enabled,
    roomId,
    supabase,
    viewerId,
    onInsert,
    onParticipantUpdate,
    onTranslationInsert,
    onStatusChange
  } = params;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const channel = supabase.channel(`chat-room-basic:${roomId}:${viewerId}`);
    console.log("[chat-room] subscription created", { roomId, viewerId });

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${roomId}`
        },
        (payload: { new: RealtimeInsertMessageRow }) => {
          const row = payload.new;

          console.log("[chat-room] subscription event received", {
            roomId,
            messageId: row.id,
            senderId: row.sender_id
          });

          onInsert(row);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_participants",
          filter: `chat_id=eq.${roomId}`
        },
        (payload: { new: RealtimeParticipantUpdateRow }) => {
          const row = payload.new;

          console.log("[chat-room] subscription event received", {
            source: "participant-update",
            roomId,
            userId: row.user_id,
            lastSeenAt: row.last_seen_at
          });

          onParticipantUpdate?.(row);
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
        (payload: { new: RealtimeTranslationInsertRow }) => {
          const row = payload.new;

          console.log("[chat-room] subscription event received", {
            source: "translation-insert",
            roomId,
            messageId: row.message_id,
            targetUserId: row.target_user_id
          });

          onTranslationInsert?.(row);
        }
      )
      .subscribe((status: RealtimeChannelStatus) => {
        console.log("[chat-room] subscription status", { roomId, viewerId, status });
        onStatusChange?.(status);
      });

    return () => {
      console.log("[chat-room] unsubscribe executed", { roomId, viewerId });
      void supabase.removeChannel(channel);
    };
  }, [
    enabled,
    onInsert,
    onParticipantUpdate,
    onStatusChange,
    onTranslationInsert,
    roomId,
    supabase,
    viewerId
  ]);
}
