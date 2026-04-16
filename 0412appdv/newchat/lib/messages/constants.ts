export const MAX_CHAT_MESSAGE_LENGTH = 300;
export const CHAT_MESSAGE_WARNING_THRESHOLD = 270;

export function getChatMessageCharacterCount(value: string) {
  return value.length;
}

export function isChatMessageTooLong(value: string) {
  return getChatMessageCharacterCount(value) > MAX_CHAT_MESSAGE_LENGTH;
}

export function normalizeChatMessageText(value: string) {
  return value.trim();
}
