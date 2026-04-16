export type DeveloperBlockParticipant = {
  id: string;
  displayName: string;
  email: string;
};

export type DeveloperBlockEntry = {
  id: string;
  blocker: DeveloperBlockParticipant;
  blockerUserId: string;
  blocked: DeveloperBlockParticipant;
  blockedUserId: string;
  createdAt: string;
};
