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
  onStatusChange?: (status: RealtimeChannelStatus) => void;
}) {
  const { enabled, roomId, supabase, viewerId, onInsert, onStatusChange } = params;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const channel = supabase.channel(`chat-room-basic:${roomId}`);

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

          onInsert(row);
        }
      )
      .subscribe((status: RealtimeChannelStatus) => {
        console.log("[chat-room] subscription status", { roomId, viewerId, status });
        onStatusChange?.(status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, onInsert, onStatusChange, roomId, supabase, viewerId]);
}
