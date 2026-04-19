import type { ChatMessage } from "@/types/chat";

function toTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export type OutgoingReadCursor = {
  lastReadMessageId?: string | null;
  lastSeenAt?: string | null;
};

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
  cursor: OutgoingReadCursor | null
): ChatMessage[] {
  const otherUserLastReadMessageId = cursor?.lastReadMessageId ?? null;
  const otherUserLastSeenAt = cursor?.lastSeenAt ?? null;
  const cursorMessage =
    otherUserLastReadMessageId != null
      ? messages.find((message) => message.id === otherUserLastReadMessageId) ?? null
      : null;
  const cursorMessageTimestamp = toTimestamp(cursorMessage?.createdAt);
  const hasCursorByMessageId = !!cursorMessage && cursorMessageTimestamp > 0;

  if (!hasCursorByMessageId && !otherUserLastSeenAt) {
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

  const otherSeenTimestamp = toTimestamp(otherUserLastSeenAt ?? undefined);

  return messages.map((message) => {
    if (message.direction !== "outgoing") {
      return message;
    }

    if (message.deliveryStatus === "sending" || message.deliveryStatus === "failed") {
      return message;
    }

    const messageTimestamp = toTimestamp(message.createdAt);
    let readStatus: ChatMessage["readStatus"] = "unread";

    if (hasCursorByMessageId) {
      if (message.id === otherUserLastReadMessageId) {
        readStatus = "read";
      } else if (messageTimestamp > 0 && messageTimestamp < cursorMessageTimestamp) {
        readStatus = "read";
      } else if (messageTimestamp > 0 && messageTimestamp === cursorMessageTimestamp) {
        readStatus =
          message.id.localeCompare(otherUserLastReadMessageId ?? "") <= 0 ? "read" : "unread";
      }
    } else {
      readStatus = messageTimestamp > 0 && messageTimestamp <= otherSeenTimestamp ? "read" : "unread";
    }

    if (message.readStatus === readStatus) {
      return message;
    }

    return {
      ...message,
      readStatus
    };
  });
}
