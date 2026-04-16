import "server-only";

import { getChatParticipantContext } from "@/lib/chats/participant-context";
import { getBlockedUserIdSetForBlocker, getFriendshipBetweenUsers, hasUserBlocked } from "@/lib/friends/relationship";
import { getDictionary, getLocaleLabel } from "@/lib/i18n/get-dictionary";
import { mapViewerMessage } from "@/lib/messages/format";
import { isChatMessageTooLong, normalizeChatMessageText } from "@/lib/messages/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { INITIAL_ROOM_MESSAGE_LIMIT } from "@/lib/chats/room-loading";
import type { Database } from "@/lib/supabase/database.types";
import { translateText } from "@/lib/openai/translate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";
import type { ChatMessage } from "@/types/chat";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type MessageTranslationRow = Database["public"]["Tables"]["message_translations"]["Row"];

export type ChatParticipantProfile = Pick<
  ProfileRow,
  "id" | "email" | "display_name" | "preferred_language" | "avatar_url"
>;

type ChatParticipantRow = {
  chat_id?: string;
  user_id: string;
  preferred_language_snapshot?: string | null;
};

export type SendMessageInput = {
  attachmentContentType?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  client: any;
  chatId: string;
  clientMessageId?: string;
  locale?: string;
  messageKind?: "text" | "image";
  senderId: string;
  originalText: string;
  originalLanguage: string;
};

export async function getChatParticipants(client: any, chatId: string, viewerId: string) {
  const context = await getChatParticipantContext({
    membershipClient: client,
    chatId,
    viewerId,
    debugLabel: "chat participants lookup"
  });

  return {
    participants: context.participants as ChatParticipantRow[],
    otherUser: context.otherParticipant as ChatParticipantRow | null,
    profiles: context.profiles as ChatParticipantProfile[]
  };
}

export async function getUserLanguage(client: any, userId: string) {
  const { data, error } = (await client
    .from("profiles")
    .select("preferred_language")
    .eq("id", userId)
    .maybeSingle()) as {
    data: Pick<ProfileRow, "preferred_language"> | null;
    error: { message?: string } | null;
  };

  if (error) {
    return null;
  }

  return data?.preferred_language ? getLocaleLabel(data.preferred_language) : null;
}

async function getSendMessageRoutingContext(chatId: string, senderId: string) {
  const admin = createSupabaseAdminClient();
  const { data: participants, error: participantError } = (await admin
    .from("chat_participants")
    .select("chat_id, user_id, preferred_language_snapshot")
    .eq("chat_id", chatId)) as {
    data: ChatParticipantRow[] | null;
    error: { message?: string } | null;
  };

  const resolvedParticipants = participants ?? [];
  const senderParticipant =
    resolvedParticipants.find((participant) => participant.user_id === senderId) ?? null;
  const receiverParticipant =
    resolvedParticipants.find((participant) => participant.user_id !== senderId) ?? null;

  const profileIds = Array.from(
    new Set(
      [senderParticipant?.user_id, receiverParticipant?.user_id].filter(Boolean) as string[]
    )
  );

  const { data: profiles, error: profileError } =
    profileIds.length > 0
      ? ((await admin
          .from("profiles")
          .select("id, email, display_name, preferred_language, avatar_url")
          .in("id", profileIds)) as {
          data: ChatParticipantProfile[] | null;
          error: { message?: string } | null;
        })
      : { data: [], error: null };

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const senderProfile = senderParticipant ? profileMap.get(senderParticipant.user_id) ?? null : null;
  const receiverProfile = receiverParticipant
    ? profileMap.get(receiverParticipant.user_id) ?? null
    : null;

  return {
    participantError,
    profileError,
    participants: resolvedParticipants,
    senderParticipant,
    receiverParticipant,
    senderProfile,
    receiverProfile
  };
}

export async function translateMessage({
  text,
  sourceLanguage,
  targetLanguage
}: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}) {
  const result = await translateText({
    originalText: text,
    sourceLanguage,
    targetLanguage
  });

  return {
    translatedText: result.translatedText,
    sourceLanguage,
    targetLanguage,
    fallbackUsed: result.fallbackUsed,
    recoverableError: result.fallbackUsed ? "Translation API returned no usable output." : undefined
  };
}

async function createMessageTranslation(params: {
  chatId: string;
  messageId: string;
  senderId: string;
  originalText: string;
  originalLanguage: string;
  targetLanguage: string;
  targetUserId: string;
}) {
  const {
    chatId,
    messageId,
    originalLanguage,
    originalText,
    senderId,
    targetLanguage,
    targetUserId
  } = params;
  const admin = createSupabaseAdminClient();
  const { otherUser, participants } = await getChatParticipants(admin, chatId, senderId);

  if (participants.length === 0 || !otherUser) {
    throw new Error("No participants found for translation.");
  }

  const translation = await translateMessage({
    text: originalText,
    sourceLanguage: originalLanguage,
    targetLanguage
  });
  const translatedText = translation.fallbackUsed ? originalText : translation.translatedText;

  console.log("originalText:", originalText);
  console.log("targetLanguage:", targetLanguage);
  console.log("translatedText BEFORE SAVE:", translatedText);

  const { error: translationError } = await admin.from("message_translations").insert({
    message_id: messageId,
    target_user_id: targetUserId,
    target_language: targetLanguage,
    translated_text: translatedText
  });

  if (translationError) {
    throw new Error(translationError.message ?? "Unable to save translated message.");
  }
}

export async function sendMessage({
  attachmentContentType,
  attachmentName,
  attachmentUrl,
  client,
  chatId,
  clientMessageId,
  locale,
  messageKind = "text",
  originalLanguage,
  originalText,
  senderId
}: SendMessageInput) {
  console.log("sendMessage start", {
    roomId: chatId,
    senderId,
    clientId: clientMessageId ?? null,
    rawMessage: originalText
  });

  if (!isUuid(chatId)) {
    throw new Error("Invalid chat room id.");
  }

  if (messageKind === "text" && isChatMessageTooLong(originalText)) {
    throw new Error(getDictionary(locale).messageTooLong);
  }

  const trimmedText = normalizeChatMessageText(originalText);

  if (!trimmedText) {
    throw new Error("Message text is required.");
  }

  const routingContext = await getSendMessageRoutingContext(chatId, senderId);
  const participants = routingContext.participants;
  const senderParticipant = routingContext.senderParticipant;
  const otherUser = routingContext.receiverParticipant;
  const senderLanguageSnapshot = senderParticipant?.preferred_language_snapshot
    ? getLocaleLabel(senderParticipant.preferred_language_snapshot)
    : routingContext.senderProfile?.preferred_language
      ? getLocaleLabel(routingContext.senderProfile.preferred_language)
      : originalLanguage || "English";
  const targetLanguage = otherUser?.preferred_language_snapshot
    ? getLocaleLabel(otherUser.preferred_language_snapshot)
    : routingContext.receiverProfile?.preferred_language
      ? getLocaleLabel(routingContext.receiverProfile.preferred_language)
      : senderLanguageSnapshot || "English";
  const canResolveSender = !!senderParticipant;
  const canResolveReceiver = !!otherUser;
  const canComputeTargetLanguage = !!targetLanguage && targetLanguage.trim().length > 0;
  const canInsertMessage = canResolveSender && canResolveReceiver && canComputeTargetLanguage;

  console.log("sendMessage participant snapshot", {
    roomId: chatId,
    senderId,
    participants,
    rowsLength: participants.length,
    senderParticipant,
    receiverParticipant: otherUser,
    senderPreferredLanguageSnapshot: senderParticipant?.preferred_language_snapshot ?? null,
    receiverPreferredLanguageSnapshot: otherUser?.preferred_language_snapshot ?? null,
    senderProfile: routingContext.senderProfile,
    receiverProfile: routingContext.receiverProfile,
    participantError: routingContext.participantError,
    profileError: routingContext.profileError
  });

  console.log("sendMessage guard status", {
    roomId: chatId,
    senderId,
    canResolveSender,
    canResolveReceiver,
    canComputeTargetLanguage,
    canInsertMessage
  });

  if (!canResolveSender || !canResolveReceiver || participants.length === 0) {
    console.error("sendMessage participant resolution failure", {
      roomId: chatId,
      senderId,
      participantsLength: participants.length,
      senderParticipant,
      receiverParticipant: otherUser,
      failedBecause: {
        participantsMissing: participants.length === 0,
        senderMissing: !senderParticipant,
        receiverMissing: !otherUser
      }
    });
    throw new Error("Unable to resolve chat participants for this message.");
  }

  if (!canComputeTargetLanguage) {
    console.error("sendMessage translation target missing", {
      roomId: chatId,
      senderId,
      senderParticipant,
      receiverParticipant: otherUser,
      senderProfile: routingContext.senderProfile,
      receiverProfile: routingContext.receiverProfile,
      senderLanguageSnapshot,
      targetLanguage
    });
    throw new Error("Unable to determine the target language for this message.");
  }

  const relationship = await getFriendshipBetweenUsers(senderId, otherUser.user_id);

  if (!relationship || relationship.status !== "accepted") {
    throw new Error("This chat is no longer available.");
  }

  if (await hasUserBlocked(senderId, otherUser.user_id)) {
    throw new Error("This chat is no longer available.");
  }

  console.log("sendMessage translation target", {
    roomId: chatId,
    senderId,
    otherUserId: otherUser.user_id,
    senderLanguageSnapshot,
    targetLanguage
  });

  const insertPayload = {
    attachment_content_type: attachmentContentType ?? null,
    attachment_name: attachmentName ?? null,
    attachment_url: attachmentUrl ?? null,
    chat_id: chatId,
    message_kind: messageKind,
    sender_id: senderId,
    original_text: trimmedText,
    original_language: senderLanguageSnapshot,
    client_message_id: clientMessageId ?? null
  };

  console.log("sendMessage insert payload", {
    roomId: chatId,
    senderId,
    clientId: clientMessageId ?? null,
    payload: insertPayload
  });

  const { data: messageRow, error: messageError } = (await createSupabaseAdminClient()
    .from("messages")
    .insert(insertPayload)
    .select(
      "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
    )
    .single()) as {
    data: MessageRow | null;
    error: { message?: string } | null;
  };

  if (messageError || !messageRow) {
    console.error("sendMessage message insert failure", {
      roomId: chatId,
      senderId,
      clientId: clientMessageId ?? null,
      insertPayload,
      messageError
    });
    throw new Error(messageError?.message ?? "Unable to save your message.");
  }

  if (messageKind === "text") {
    setTimeout(() => {
      void createMessageTranslation({
        chatId,
        messageId: messageRow.id,
        senderId,
        originalText: trimmedText,
        originalLanguage: senderLanguageSnapshot,
        targetLanguage,
        targetUserId: otherUser.user_id
      }).catch((error) => {
        console.error("sendMessage translation insert failure", {
          roomId: chatId,
          senderId,
          messageId: messageRow.id,
          targetUserId: otherUser.user_id,
          targetLanguage,
          error
        });
      });
    }, 0);
  }

  return {
    attachmentContentType: messageRow.attachment_content_type ?? undefined,
    attachmentName: messageRow.attachment_name ?? undefined,
    id: messageRow.id,
    clientId: messageRow.client_message_id ?? clientMessageId,
    chatId: messageRow.chat_id,
    imageUrl: messageRow.attachment_url ?? undefined,
    messageType: (messageRow.message_kind as "text" | "image") ?? messageKind,
    originalText: messageRow.original_text,
    originalLanguage: messageRow.original_language,
    targetLanguage,
    createdAt: messageRow.created_at
  };
}

export async function getChatMessagesForViewer(
  chatId: string,
  viewerId: string,
  options?: {
    beforeCreatedAt?: string | null;
    limit?: number;
  }
): Promise<ChatMessage[]> {
  if (!isUuid(chatId)) {
    console.error("getChatMessagesForViewer invalid roomId", { chatId, viewerId });
    return [];
  }

  const client = await createSupabaseServerClient();
  let query = client
    .from("messages")
    .select(
      "id, chat_id, sender_id, original_text, original_language, created_at, client_message_id, message_kind, attachment_url, attachment_name, attachment_content_type"
    )
    .eq("chat_id", chatId);

  if (options?.beforeCreatedAt) {
    query = query.lt("created_at", options.beforeCreatedAt);
  }

  const { data: messageRows, error: messagesError } = (await query
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? INITIAL_ROOM_MESSAGE_LIMIT)) as {
    data: MessageRow[] | null;
    error: { message?: string } | null;
  };

  if (messagesError || !messageRows) {
    return [];
  }

  let hiddenSenderIds = new Set<string>();

  try {
    const senderIds = Array.from(
      new Set((messageRows ?? []).map((message) => message.sender_id).filter((senderId) => senderId !== viewerId))
    ) as string[];
    hiddenSenderIds = await getBlockedUserIdSetForBlocker(viewerId, senderIds);
  } catch (error) {
    console.error("getChatMessagesForViewer block lookup failure", {
      chatId,
      viewerId,
      error
    });
  }

  const orderedMessageRows = [...messageRows]
    .filter((message) => !hiddenSenderIds.has(message.sender_id))
    .reverse();
  const messageIds = orderedMessageRows.map((message) => message.id);

  const { data: translationRows } = (await client
    .from("message_translations")
    .select("id, message_id, target_user_id, target_language, translated_text, created_at")
    .eq("target_user_id", viewerId)
    .in("message_id", messageIds)) as {
    data: MessageTranslationRow[] | null;
    error: { message?: string } | null;
  };

  const translationMap = new Map((translationRows ?? []).map((row) => [row.message_id, row]));

  return orderedMessageRows.map((message) => {
    const translation = translationMap.get(message.id);
    const outgoing = message.sender_id === viewerId;
    return mapViewerMessage({
      attachmentContentType: message.attachment_content_type,
      attachmentName: message.attachment_name,
      attachmentUrl: message.attachment_url,
      id: message.id,
      clientId: message.client_message_id,
      chatId: message.chat_id,
      senderId: message.sender_id,
      viewerId,
      originalText: message.original_text,
      originalLanguage: message.original_language,
      createdAt: message.created_at,
      messageType: (message.message_kind as "text" | "image") ?? "text",
      translatedText: translation?.translated_text,
      translatedLanguage: translation?.target_language
    });
  });
}
