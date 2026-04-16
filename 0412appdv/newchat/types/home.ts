export type ChatRoomPreview = {
  id: string;
  roomId: string;
  peerUserId?: string;
  recipientName: string;
  recipientAvatarUrl?: string;
  latestMessagePreview: string;
  latestMessageAt: string;
  latestMessageCreatedAt?: string;
  peerLastSeenAt?: string;
  viewerLastSeenAt?: string;
  lastMessageId?: string;
  unreadCount?: number;
  selected?: boolean;
};
