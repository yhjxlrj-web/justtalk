import type { ChatMessage } from "@/types/chat";

const roomMessageCache = new Map<string, ChatMessage[]>();

export function getCachedRoomMessages(roomId: string) {
  return roomMessageCache.get(roomId) ?? null;
}

export function setCachedRoomMessages(roomId: string, messages: ChatMessage[]) {
  roomMessageCache.set(roomId, messages);
}

export function clearCachedRoomMessages(roomId: string) {
  roomMessageCache.delete(roomId);
}
