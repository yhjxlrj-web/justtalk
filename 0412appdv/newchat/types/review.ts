export type CommunityReviewItem = {
  id: string;
  reviewerUserId: string;
  targetUserId: string;
  reviewText: string;
  reviewerDisplayName: string;
  reviewerAvatarUrl?: string;
  createdAt: number;
};
