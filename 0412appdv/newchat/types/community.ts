import type { FriendProfileSummary } from "@/types/friends";

export type CommunityProfileItem = FriendProfileSummary & {
  createdAt?: string;
  updatedAt?: string;
};

export type CommunityProfileCacheEntry = {
  fetchedAt: number;
  hasOverflow: boolean;
  profiles: CommunityProfileItem[];
  refreshDate: string;
};

export type CommunityNotificationItem = {
  id: string;
  receiverUserId: string;
  senderUserId: string;
  senderProfile: CommunityProfileItem;
  createdAt: number;
  type: "heart";
};
