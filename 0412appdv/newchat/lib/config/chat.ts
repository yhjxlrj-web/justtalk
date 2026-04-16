import type { ChatMessage, ChatRoomSummary } from "@/types/chat";

export const roomSummaries: ChatRoomSummary[] = [
  {
    id: "general",
    name: "Mina Park",
    topic: "Shared bilingual conversation space for day-to-day updates.",
    languagePair: "EN / KO",
    avatarUrl: undefined
  },
  {
    id: "product-sync",
    name: "Daniel Wu",
    topic: "Product planning and review conversations.",
    languagePair: "EN / JA",
    avatarUrl: undefined
  },
  {
    id: "customer-voice",
    name: "Sofia Alvarez",
    topic: "Customer insights and multilingual support context.",
    languagePair: "EN / ES",
    avatarUrl: undefined
  }
];

const roomMessages: Record<string, ChatMessage[]> = {
  general: [
    {
      id: "msg-1",
      direction: "incoming",
      body: "Morning. Can we pin the launch brief for the new team members?",
      language: "English",
      timestamp: "09:08"
    },
    {
      id: "msg-2",
      direction: "outgoing",
      body: "Absolutely. I’ll keep the summary easy to scan at the top.",
      language: "English",
      timestamp: "09:10"
    },
    {
      id: "msg-3",
      direction: "incoming",
      body: "Perfect. Let’s also keep the technical glossary close by.",
      language: "English",
      timestamp: "09:12"
    }
  ],
  "product-sync": [
    {
      id: "msg-4",
      direction: "incoming",
      body: "The onboarding review moved up. Can we finalize the copy today?",
      language: "English",
      timestamp: "11:02"
    },
    {
      id: "msg-5",
      direction: "outgoing",
      body: "Yes, I’ll prioritize the highest-impact screens first.",
      language: "English",
      timestamp: "11:05"
    }
  ],
  "customer-voice": []
};

export function getRoomById(roomId: string) {
  return (
    roomSummaries.find((room) => room.id === roomId) ?? {
      id: roomId,
      name: "New conversation",
      topic: "Connect this screen to your Supabase room and message tables.",
      languagePair: "EN / KO",
      avatarUrl: undefined
    }
  );
}

export function getMessagesForRoom(roomId: string) {
  return roomMessages[roomId] ?? [];
}
