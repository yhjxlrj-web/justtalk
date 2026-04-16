export type FriendRelationshipStatus = "pending" | "accepted" | "rejected" | "blocked";

export type FriendRelationship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendRelationshipStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type FriendProfileSummary = {
  id: string;
  email: string;
  displayName: string;
  statusMessage?: string;
  country: string;
  preferredLanguage: string;
  avatarUrl?: string;
  lastActiveAt?: string;
  showLastSeen?: boolean;
};

export type FriendListItem = {
  relationship: FriendRelationship;
  profile: FriendProfileSummary;
  direction: "incoming" | "outgoing";
};

export type FriendCollections = {
  incomingRequests: FriendListItem[];
  sentRequests: FriendListItem[];
  acceptedFriends: FriendListItem[];
  blockedUsers: FriendListItem[];
};
