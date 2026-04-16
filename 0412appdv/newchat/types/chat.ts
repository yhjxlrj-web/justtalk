export type ChatDirection = "incoming" | "outgoing";

export type ChatReaction = {
  emoji: string;
  count: number;
  reactedByViewer: boolean;
};

export type ChatMessage = {
  id: string;
  clientId?: string;
  chatRoomId?: string;
  senderId?: string;
  messageType?: "text" | "image";
  direction: ChatDirection;
  originalText?: string;
  displayText?: string;
  body: string;
  originalBody?: string;
  senderLanguage?: string;
  targetLanguage?: string;
  language: string;
  timestamp: string;
  createdAt?: string;
  imageUrl?: string;
  attachmentName?: string;
  attachmentContentType?: string;
  canRetry?: boolean;
  deliveryStatus?: "sending" | "sent" | "failed";
  readStatus?: "read" | "unread" | null;
  reactions?: ChatReaction[];
};

export type ChatRoomSummary = {
  id: string;
  name: string;
  topic: string;
  languagePair: string;
  avatarUrl?: string;
  unreadCount?: number;
  myLanguage?: string;
  peerLanguage?: string;
  peerProfile?: {
    id: string;
    displayName: string;
    statusMessage?: string;
    country: string;
    preferredLanguage: string;
    avatarUrl?: string;
    lastSeenAt?: string;
    showLastSeen: boolean;
  };
};
