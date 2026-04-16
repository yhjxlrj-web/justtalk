export type SendMessageFormState = {
  error?: string;
  success?: boolean;
  message?: {
    id: string;
    clientId?: string;
    chatId: string;
    originalText: string;
    originalLanguage: string;
    messageType?: "text" | "image";
    imageUrl?: string;
    attachmentName?: string;
    attachmentContentType?: string;
    targetLanguage?: string;
    createdAt: string;
  };
};

export const initialSendMessageFormState: SendMessageFormState = {};
