export type UserProfile = {
  id: string;
  email?: string;
  displayName: string;
  statusMessage?: string;
  lastSeenAt?: string;
  showLastSeen: boolean;
  country: string;
  preferredLanguage: string;
  avatarUrl?: string;
  profileCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
};
