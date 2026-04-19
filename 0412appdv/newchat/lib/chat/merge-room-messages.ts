import type { ChatMessage } from "@/types/chat";

function toTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortRoomMessagesStable(messages: ChatMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTimestamp = toTimestamp(left.createdAt);
    const rightTimestamp = toTimestamp(right.createdAt);

    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    return left.id.localeCompare(right.id);
  });
}

export function dedupeRoomMessagesById(messages: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();

  for (const message of messages) {
    byId.set(message.id, message);
  }

  return sortRoomMessagesStable([...byId.values()]);
}

export function extractPendingMessages(messages: ChatMessage[]) {
  return messages.filter(
    (message) =>
      message.direction === "outgoing" &&
      (message.deliveryStatus === "sending" || message.deliveryStatus === "failed")
  );
}

export function mergeServerMessagesWithPending(serverMessages: ChatMessage[], currentMessages: ChatMessage[]) {
  const pendingMessages = extractPendingMessages(currentMessages);
  return dedupeRoomMessagesById([...serverMessages, ...pendingMessages]);
}
