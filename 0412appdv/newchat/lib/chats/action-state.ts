export type OpenDirectChatState = {
  chatId?: string;
  error?: string;
  friendshipId?: string;
  otherUserId?: string;
};

export const initialOpenDirectChatState: OpenDirectChatState = {};

export type DeleteChatHistoryState = {
  success?: boolean;
  error?: string;
};

export const initialDeleteChatHistoryState: DeleteChatHistoryState = {};

export type LeaveChatRoomState = {
  redirectTo?: string;
  error?: string;
};

export const initialLeaveChatRoomState: LeaveChatRoomState = {};
