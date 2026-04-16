export type CreateFriendRequestFormState = {
  errors: {
    email?: string;
    form?: string;
  };
  friendshipId?: string;
  otherUserId?: string;
  relationshipStatus?: "pending" | "accepted";
  successMessage?: string;
};

export const initialCreateFriendRequestFormState: CreateFriendRequestFormState = {
  errors: {}
};

export type RespondToFriendRequestFormState = {
  error?: string;
  successMessage?: string;
  decision?: "accepted" | "rejected";
};

export const initialRespondToFriendRequestFormState: RespondToFriendRequestFormState = {};

export type ManageFriendshipFormState = {
  action?: "block" | "unblock";
  error?: string;
  friendshipId?: string;
  otherUserId?: string;
  successMessage?: string;
};

export const initialManageFriendshipFormState: ManageFriendshipFormState = {};
