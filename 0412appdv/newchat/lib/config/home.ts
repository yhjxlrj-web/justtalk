import type { ChatRoomPreview } from "@/types/home";

export const fallbackChatRoomPreviews: ChatRoomPreview[] = [
  {
    id: "chat-preview-general",
    roomId: "general",
    recipientName: "Global general",
    latestMessagePreview: "Pinned summary updated in English and Korean.",
    latestMessageAt: "09:24",
    selected: true
  },
  {
    id: "chat-preview-product-sync",
    roomId: "product-sync",
    recipientName: "Product sync",
    latestMessagePreview: "Mobile onboarding copy is ready for review.",
    latestMessageAt: "08:55"
  },
  {
    id: "chat-preview-customer-voice",
    roomId: "customer-voice",
    recipientName: "Customer voice",
    latestMessagePreview: "New bilingual feedback digest just landed.",
    latestMessageAt: "Yesterday"
  }
];
