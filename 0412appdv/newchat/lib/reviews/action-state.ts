import type { CommunityReviewItem } from "@/types/review";

export type CreateCommunityReviewActionState = {
  error?: string;
  alreadyReviewedToday?: boolean;
  successMessage?: string;
  createdReview?: CommunityReviewItem;
};

export const initialCreateCommunityReviewActionState: CreateCommunityReviewActionState = {};
