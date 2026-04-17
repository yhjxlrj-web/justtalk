import type { ChatMessage } from "@/types/chat";

const roomMessageCache = new Map<string, ChatMessage[]>();

export function getCachedRoomMessages(roomId: string) {
  return roomMessageCache.get(roomId) ?? null;
}

export function setCachedRoomMessages(roomId: string, messages: ChatMessage[]) {
  roomMessageCache.set(roomId, messages);
}

export function patchCachedRoomMessages(
  roomId: string,
  updater: (messages: ChatMessage[] | null) => ChatMessage[] | null
) {
  const currentMessages = roomMessageCache.get(roomId) ?? null;
  const nextMessages = updater(currentMessages);

  if (!nextMessages) {
    roomMessageCache.delete(roomId);
    return;
  }

  roomMessageCache.set(roomId, nextMessages);
}

export function clearCachedRoomMessages(roomId: string) {
  roomMessageCache.delete(roomId);
}
