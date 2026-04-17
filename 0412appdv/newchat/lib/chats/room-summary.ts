import "server-only";

import { normalizeChatMessageText } from "@/lib/messages/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SummaryParticipantRow = {
  user_id: string;
  display_name_snapshot?: string | null;
  avatar_url_snapshot?: string | null;
  preferred_language_snapshot?: string | null;
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
};

const IMAGE_PREVIEW_TEXT = "Photo";
const EMPTY_PREVIEW_TEXT = "No messages yet.";

function coercePreviewText(value: string | null | undefined) {
  const normalized = normalizeChatMessageText(value ?? "");
  return normalized || EMPTY_PREVIEW_TEXT;
}

function toSummaryErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }

  return String(error ?? "");
}

export function isChatRoomSummaryUnavailableError(error: unknown) {
  const message = toSummaryErrorMessage(error).toLowerCase();

  return (
    message.includes("chat_room_summaries") &&
    (message.includes("does not exist") ||
      message.includes("could not find the table") ||
      message.includes("could not find relation"))
  );
}

function resolveMessagePreviewText(params: {
  messageKind?: "image" | "text" | null;
  text?: string | null;
}) {
  if (params.messageKind === "image") {
    return IMAGE_PREVIEW_TEXT;
  }

  return coercePreviewText(params.text);
}

async function getRoomParticipants(roomId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = (await admin
    .from("chat_participants")
    .select(
      "user_id, display_name_snapshot, avatar_url_snapshot, preferred_language_snapshot"
    )
    .eq("chat_id", roomId)) as {
    data: SummaryParticipantRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "Unable to load chat participants for room summary.");
  }

  return data ?? [];
}

async function getExistingRoomSummaries(roomId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = (await admin
    .from("chat_room_summaries")
    .select(
      "room_id, user_id, peer_user_id, peer_display_name_snapshot, peer_avatar_snapshot, peer_preferred_language_snapshot, last_message_id, last_message_preview, last_message_created_at, unread_count"
    )
    .eq("room_id", roomId)) as {
    data: ChatRoomSummaryRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function upsertRoomSummaries(rows: ChatRoomSummaryRow[]) {
  if (rows.length === 0) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("chat_room_summaries").upsert(rows, {
    onConflict: "room_id,user_id"
  });

  if (error) {
    throw error;
  }
}

export async function ensureChatRoomSummaries(roomId: string) {
  try {
    const participants = await getRoomParticipants(roomId);

    if (participants.length === 0) {
      return;
    }

    const existingRows = await getExistingRoomSummaries(roomId);
    const existingRowByUserId = new Map(existingRows.map((row) => [row.user_id, row]));
    const rowsToUpsert = participants.map((participant) => {
      const peer = participants.find((candidate) => candidate.user_id !== participant.user_id) ?? null;
      const existingRow = existingRowByUserId.get(participant.user_id);

      return {
        room_id: roomId,
        user_id: participant.user_id,
        peer_user_id: peer?.user_id ?? existingRow?.peer_user_id ?? null,
        peer_display_name_snapshot:
          peer?.display_name_snapshot ?? existingRow?.peer_display_name_snapshot ?? null,
        peer_avatar_snapshot:
          peer?.avatar_url_snapshot ?? existingRow?.peer_avatar_snapshot ?? null,
        peer_preferred_language_snapshot:
          peer?.preferred_language_snapshot ??
          existingRow?.peer_preferred_language_snapshot ??
          null,
        last_message_id: existingRow?.last_message_id ?? null,
        last_message_preview:
          existingRow?.last_message_preview != null
            ? coercePreviewText(existingRow.last_message_preview)
            : EMPTY_PREVIEW_TEXT,
        last_message_created_at: existingRow?.last_message_created_at ?? null,
        unread_count: existingRow?.unread_count ?? 0
      } satisfies ChatRoomSummaryRow;
    });

    await upsertRoomSummaries(rowsToUpsert);
  } catch (error) {
    if (isChatRoomSummaryUnavailableError(error)) {
      return;
    }

    console.error("ensureChatRoomSummaries failed", {
      roomId,
      error
    });
  }
}

export async function applyMessageToChatRoomSummaries(params: {
  messageCreatedAt: string;
  messageId: string;
  messageKind?: "text" | "image";
  originalText: string;
  roomId: string;
  senderId: string;
  translatedPreviewByUserId?: Map<string, string>;
}) {
  const {
    messageCreatedAt,
    messageId,
    messageKind = "text",
    originalText,
    roomId,
    senderId,
    translatedPreviewByUserId
  } = params;

  try {
    const participants = await getRoomParticipants(roomId);

    if (participants.length === 0) {
      return;
    }

    const existingRows = await getExistingRoomSummaries(roomId);
    const existingRowByUserId = new Map(existingRows.map((row) => [row.user_id, row]));
    const senderPreview = resolveMessagePreviewText({
      messageKind,
      text: originalText
    });

    const rowsToUpsert = participants.map((participant) => {
      const peer = participants.find((candidate) => candidate.user_id !== participant.user_id) ?? null;
      const existingRow = existingRowByUserId.get(participant.user_id);
      const userSpecificPreview = translatedPreviewByUserId?.get(participant.user_id);
      const resolvedPreview =
        participant.user_id === senderId
          ? senderPreview
          : resolveMessagePreviewText({
              messageKind,
              text: userSpecificPreview ?? originalText
            });
      const existingUnread = Math.max(0, existingRow?.unread_count ?? 0);

      return {
        room_id: roomId,
        user_id: participant.user_id,
        peer_user_id: peer?.user_id ?? existingRow?.peer_user_id ?? null,
        peer_display_name_snapshot:
          peer?.display_name_snapshot ?? existingRow?.peer_display_name_snapshot ?? null,
        peer_avatar_snapshot:
          peer?.avatar_url_snapshot ?? existingRow?.peer_avatar_snapshot ?? null,
        peer_preferred_language_snapshot:
          peer?.preferred_language_snapshot ??
          existingRow?.peer_preferred_language_snapshot ??
          null,
        last_message_id: messageId,
        last_message_preview: resolvedPreview,
        last_message_created_at: messageCreatedAt,
        unread_count:
          participant.user_id === senderId ? existingUnread : existingUnread + 1
      } satisfies ChatRoomSummaryRow;
    });

    await upsertRoomSummaries(rowsToUpsert);
  } catch (error) {
    if (isChatRoomSummaryUnavailableError(error)) {
      return;
    }

    console.error("applyMessageToChatRoomSummaries failed", {
      roomId,
      senderId,
      messageId,
      error
    });
  }
}

export async function applyTranslatedPreviewToChatRoomSummary(params: {
  messageId: string;
  roomId: string;
  targetUserId: string;
  translatedText: string;
}) {
  const { messageId, roomId, targetUserId, translatedText } = params;

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("chat_room_summaries")
      .update({
        last_message_preview: coercePreviewText(translatedText)
      })
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)
      .eq("last_message_id", messageId);

    if (error) {
      throw error;
    }
  } catch (error) {
    if (isChatRoomSummaryUnavailableError(error)) {
      return;
    }

    console.error("applyTranslatedPreviewToChatRoomSummary failed", {
      roomId,
      targetUserId,
      messageId,
      error
    });
  }
}

export async function resetChatRoomSummariesForRoom(roomId: string) {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("chat_room_summaries")
      .update({
        last_message_id: null,
        last_message_preview: EMPTY_PREVIEW_TEXT,
        last_message_created_at: null,
        unread_count: 0
      })
      .eq("room_id", roomId);

    if (error) {
      throw error;
    }
  } catch (error) {
    if (isChatRoomSummaryUnavailableError(error)) {
      return;
    }

    console.error("resetChatRoomSummariesForRoom failed", {
      roomId,
      error
    });
  }
}

export async function syncPeerSnapshotAcrossChatSummaries(params: {
  avatarUrl: string | null;
  displayName: string | null;
  preferredLanguage: string | null;
  userId: string;
}) {
  const { avatarUrl, displayName, preferredLanguage, userId } = params;

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("chat_room_summaries")
      .update({
        peer_display_name_snapshot: displayName,
        peer_avatar_snapshot: avatarUrl,
        peer_preferred_language_snapshot: preferredLanguage
      })
      .eq("peer_user_id", userId);

    if (error) {
      throw error;
    }
  } catch (error) {
    if (isChatRoomSummaryUnavailableError(error)) {
      return;
    }

    console.error("syncPeerSnapshotAcrossChatSummaries failed", {
      userId,
      error
    });
  }
}

