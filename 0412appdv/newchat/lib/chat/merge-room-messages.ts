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

export function applyOutgoingReadState(
  messages: ChatMessage[],
  otherUserLastSeenAt: string | null,
  otherUserLastReadMessageId?: string | null
): ChatMessage[] {
  const messageIndexById = new Map(messages.map((message, index) => [message.id, index]));
  const lastReadMessageIndex =
    otherUserLastReadMessageId != null
      ? (messageIndexById.get(otherUserLastReadMessageId) ?? -1)
      : -1;

  if (!otherUserLastSeenAt) {
    return messages.map((message) =>
      message.direction === "outgoing" &&
      message.deliveryStatus !== "sending" &&
      message.deliveryStatus !== "failed"
        ? {
            ...message,
            readStatus: "unread" as const
          }
        : message
    );
  }

  const otherSeenTimestamp = toTimestamp(otherUserLastSeenAt);

  return messages.map((message) => {
    if (message.direction !== "outgoing") {
      return message;
    }

    if (message.deliveryStatus === "sending" || message.deliveryStatus === "failed") {
      return message;
    }

    const messageTimestamp = toTimestamp(message.createdAt);
    const hasReadCursorByMessageId = lastReadMessageIndex >= 0;
    const currentMessageIndex = messageIndexById.get(message.id) ?? -1;
    const readStatus: ChatMessage["readStatus"] = hasReadCursorByMessageId
      ? currentMessageIndex >= 0 && currentMessageIndex <= lastReadMessageIndex
        ? "read"
        : "unread"
      : messageTimestamp > 0 && messageTimestamp <= otherSeenTimestamp
        ? "read"
        : "unread";

    if (message.readStatus === readStatus) {
      return message;
    }

    return {
      ...message,
      readStatus
    };
  });
}
