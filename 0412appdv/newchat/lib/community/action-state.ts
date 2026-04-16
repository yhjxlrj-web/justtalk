export type CommunityHeartActionState = {
  alreadySent?: boolean;
  error?: string;
  notificationId?: string;
  receiverUserId?: string;
  success?: boolean;
};

export const initialCommunityHeartActionState: CommunityHeartActionState = {};
