import type { CommunityReviewItem } from "@/types/review";

const profileReviewCache = new Map<string, CommunityReviewItem[]>();

export function getCachedProfileReviews(targetUserId: string) {
  return profileReviewCache.get(targetUserId) ?? [];
}

export function setCachedProfileReviews(targetUserId: string, reviews: CommunityReviewItem[]) {
  profileReviewCache.set(targetUserId, reviews);
}

export function patchCachedProfileReviews(
  targetUserId: string,
  updater: (current: CommunityReviewItem[]) => CommunityReviewItem[]
) {
  const nextReviews = updater(getCachedProfileReviews(targetUserId));
  profileReviewCache.set(targetUserId, nextReviews);
  return nextReviews;
}
