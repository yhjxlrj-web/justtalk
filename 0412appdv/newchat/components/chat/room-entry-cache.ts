import type { ChatMessage } from "@/types/chat";

export type RoomEntrySnapshot = {
  initialScrollTargetMessageId: string | null;
  messages: ChatMessage[];
  hasOlderMessages?: boolean;
  otherUserLastSeenAt?: string | null;
  preloadedAt: number;
};

const roomEntryCache = new Map<string, RoomEntrySnapshot>();

const RECENT_ROOMS_STORAGE_KEY = "talkbridge-recent-chat-rooms";

export function getCachedRoomEntrySnapshot(roomId: string) {
  return roomEntryCache.get(roomId) ?? null;
}

export function setCachedRoomEntrySnapshot(roomId: string, snapshot: RoomEntrySnapshot) {
  roomEntryCache.set(roomId, snapshot);
}

export function patchCachedRoomEntrySnapshot(
  roomId: string,
  updater: (snapshot: RoomEntrySnapshot | null) => RoomEntrySnapshot | null
) {
  const currentSnapshot = roomEntryCache.get(roomId) ?? null;
  const nextSnapshot = updater(currentSnapshot);

  if (!nextSnapshot) {
    roomEntryCache.delete(roomId);
    return;
  }

  roomEntryCache.set(roomId, nextSnapshot);
}

export function clearCachedRoomEntrySnapshot(roomId: string) {
  roomEntryCache.delete(roomId);
}

export function recordRecentChatRoom(roomId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const existing = JSON.parse(
      window.sessionStorage.getItem(RECENT_ROOMS_STORAGE_KEY) ?? "[]"
    ) as string[];
    const next = [roomId, ...existing.filter((value) => value !== roomId)].slice(0, 6);
    window.sessionStorage.setItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

export function getRecentChatRooms() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.sessionStorage.getItem(RECENT_ROOMS_STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
