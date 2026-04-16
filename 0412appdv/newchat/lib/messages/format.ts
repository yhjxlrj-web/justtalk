import type { ChatMessage } from "@/types/chat";

export function formatChatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function mapViewerMessage(params: {
  id: string;
  clientId?: string | null;
  chatId?: string;
  senderId: string;
  viewerId: string;
  attachmentContentType?: string | null;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  originalText: string;
  originalLanguage: string;
  createdAt: string;
  messageType?: "text" | "image";
  translatedText?: string | null;
  translatedLanguage?: string | null;
}): ChatMessage {
  const outgoing = params.senderId === params.viewerId;

  return {
    id: params.id,
    clientId: params.clientId ?? undefined,
    chatRoomId: params.chatId,
    senderId: params.senderId,
    direction: outgoing ? "outgoing" : "incoming",
    messageType: params.messageType ?? "text",
    originalText: params.originalText,
    displayText: outgoing ? params.originalText : params.translatedText ?? params.originalText,
    body: outgoing ? params.originalText : params.translatedText ?? params.originalText,
    originalBody: outgoing ? undefined : params.originalText,
    senderLanguage: params.originalLanguage,
    targetLanguage: outgoing
      ? params.originalLanguage
      : params.translatedLanguage ?? params.originalLanguage,
    language: outgoing
      ? params.originalLanguage
      : params.translatedLanguage ?? params.originalLanguage,
    timestamp: formatChatTimestamp(params.createdAt),
    createdAt: params.createdAt,
    imageUrl: params.attachmentUrl ?? undefined,
    attachmentName: params.attachmentName ?? undefined,
    attachmentContentType: params.attachmentContentType ?? undefined,
    reactions: []
  };
}
