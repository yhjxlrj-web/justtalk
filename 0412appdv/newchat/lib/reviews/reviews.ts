import type { CommunityReviewItem } from "@/types/review";

type CommunityReviewRow = {
  id: string;
  reviewer_user_id: string;
  target_user_id: string;
  review_text: string;
  reviewer_display_name?: string | null;
  reviewer_avatar_url?: string | null;
  created_at?: string | null;
};

function toTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getSeoulDayBounds() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter
    .formatToParts(new Date())
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }

      return result;
    }, {});

  const year = parts.year ?? "1970";
  const month = parts.month ?? "01";
  const day = parts.day ?? "01";

  return {
    start: `${year}-${month}-${day}T00:00:00+09:00`,
    end: `${year}-${month}-${day}T23:59:59.999+09:00`
  };
}

export function mapCommunityReviewRow(row: CommunityReviewRow): CommunityReviewItem {
  return {
    id: row.id,
    reviewerUserId: row.reviewer_user_id,
    targetUserId: row.target_user_id,
    reviewText: row.review_text,
    reviewerDisplayName: row.reviewer_display_name ?? "JustTalk user",
    reviewerAvatarUrl: row.reviewer_avatar_url ?? undefined,
    createdAt: toTimestamp(row.created_at)
  };
}

export async function getCommunityReviews(client: any, targetUserId: string) {
  const { data, error } = (await client
    .from("community_reviews")
    .select(
      "id, reviewer_user_id, target_user_id, review_text, reviewer_display_name, reviewer_avatar_url, created_at"
    )
    .eq("target_user_id", targetUserId)
    .order("created_at", { ascending: false })) as {
    data: CommunityReviewRow[] | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "Unable to load community reviews.");
  }

  return (data ?? []).map(mapCommunityReviewRow);
}

export async function findTodayCommunityReview(params: {
  admin: any;
  reviewerUserId: string;
  targetUserId: string;
}) {
  const { admin, reviewerUserId, targetUserId } = params;
  const dayBounds = getSeoulDayBounds();
  const { data, error } = (await admin
    .from("community_reviews")
    .select("id")
    .eq("reviewer_user_id", reviewerUserId)
    .eq("target_user_id", targetUserId)
    .gte("created_at", dayBounds.start)
    .lte("created_at", dayBounds.end)
    .limit(1)
    .maybeSingle()) as {
    data: { id: string } | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "Unable to verify today's review.");
  }

  return data;
}
