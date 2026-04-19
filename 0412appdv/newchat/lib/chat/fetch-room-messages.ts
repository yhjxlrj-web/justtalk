import { INITIAL_ROOM_MESSAGE_LIMIT } from "@/lib/chats/room-loading";
import { formatChatTimestamp } from "@/lib/messages/format";
import { sortRoomMessagesStable } from "@/lib/chat/merge-room-messages";
import type { ChatMessage } from "@/types/chat";

type MessageRow = {
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

type TranslationRow = {
  message_id: string;
  translated_text: string;
  target_language: string;
};

type ParticipantRow = {
  user_id: string;
  last_seen_at: string | null;
  last_read_message_id: string | null;
};

export type RoomMessagesFetchResult = {
  messages: ChatMessage[];
  hasOlderMessages: boolean;
  otherUserLastSeenAt: string | null;
  otherUserLastReadMessageId: string | null;
};

function mapMessageRowToChatMessage(params: {
  row: MessageRow;
  translation: TranslationRow | undefined;
  viewerId: string;
}): ChatMessage {
  const { row, translation, viewerId } = params;
  const outgoing = row.sender_id === viewerId;
  const messageType = row.message_kind ?? "text";
  const hasTranslation = !!translation?.translated_text;
  const displayBody = outgoing ? row.original_text : translation?.translated_text ?? row.original_text;
  const translationPending = !outgoing && messageType === "text" && !hasTranslation;

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
    targetLanguage: outgoing
      ? row.original_language
      : translation?.target_language ?? row.original_language,
    language: outgoing
      ? row.original_language
      : translation?.target_language ?? row.original_language,
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

export async function fetchRoomMessages(params: {
  roomId: string;
  supabase: any;
  viewerId: string;
  limit?: number;
}): Promise<RoomMessagesFetchResult> {
  const { roomId, supabase, viewerId, limit = INITIAL_ROOM_MESSAGE_LIMIT } = params;
  const [{ data: participantRows, error: participantsError }, { data: recentRows, error: messagesError }] =
    await Promise.all([
      supabase
        .from("chat_participants")
        .select("user_id, last_seen_at, last_read_message_id")
        .eq("chat_id", roomId),
      supabase
        .from("messages")
        .select(
          "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
        )
        .eq("chat_id", roomId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit)
    ]);

  if (participantsError) {
    throw participantsError;
  }

  if (messagesError) {
    throw messagesError;
  }

  const participantList = (participantRows ?? []) as ParticipantRow[];
  const otherParticipant = participantList.find((participant) => participant.user_id !== viewerId) ?? null;
  const otherUserLastSeenAt = otherParticipant?.last_seen_at ?? null;
  const otherUserLastReadMessageId = otherParticipant?.last_read_message_id ?? null;

  const orderedRows = [...((recentRows ?? []) as MessageRow[])].reverse();
  const messageIds = orderedRows.map((row) => row.id);

  const { data: translationRows, error: translationsError } =
    messageIds.length > 0
      ? await supabase
          .from("message_translations")
          .select("message_id, translated_text, target_language")
          .eq("target_user_id", viewerId)
          .in("message_id", messageIds)
      : { data: [], error: null };

  if (translationsError) {
    throw translationsError;
  }

  const translationByMessageId = new Map(
    ((translationRows ?? []) as TranslationRow[]).map((row) => [row.message_id, row])
  );

  const mappedMessages = sortRoomMessagesStable(
    orderedRows.map((row) =>
      mapMessageRowToChatMessage({
        row,
        translation: translationByMessageId.get(row.id),
        viewerId
      })
    )
  );

  const oldestMessageCreatedAt = orderedRows[0]?.created_at ?? null;
  let hasOlderMessages = false;

  if (oldestMessageCreatedAt) {
    const { data: olderRows, error: olderRowsError } = await supabase
      .from("messages")
      .select("id")
      .eq("chat_id", roomId)
      .lt("created_at", oldestMessageCreatedAt)
      .order("created_at", { ascending: false })
      .limit(1);

    if (olderRowsError) {
      throw olderRowsError;
    }

    hasOlderMessages = (olderRows?.length ?? 0) > 0;
  }

  return {
    messages: mappedMessages,
    hasOlderMessages,
    otherUserLastSeenAt,
    otherUserLastReadMessageId
  };
}
