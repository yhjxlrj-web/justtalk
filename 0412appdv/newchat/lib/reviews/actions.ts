"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReviewCopy } from "@/lib/i18n/review-copy";
import type { SupportedLocale } from "@/lib/i18n/messages";
import {
  initialCreateCommunityReviewActionState,
  type CreateCommunityReviewActionState
} from "@/lib/reviews/action-state";
import { MAX_COMMUNITY_REVIEW_LENGTH } from "@/lib/reviews/constants";
import { findTodayCommunityReview } from "@/lib/reviews/reviews";

type ReviewerProfileRow = {
  display_name?: string | null;
  avatar_url?: string | null;
};

function resolveLocale(value: string): SupportedLocale {
  if (value === "ko" || value === "es") {
    return value;
  }

  return "en";
}

export async function createCommunityReviewAction(
  _prevState: CreateCommunityReviewActionState = initialCreateCommunityReviewActionState,
  formData: FormData
): Promise<CreateCommunityReviewActionState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en").trim());
  const copy = getReviewCopy(locale);
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const reviewText = String(formData.get("reviewText") ?? "").trim();

  if (!targetUserId || !reviewText) {
    return {
      error: copy.submitError
    };
  }

  if (reviewText.length > MAX_COMMUNITY_REVIEW_LENGTH) {
    return {
      error: copy.maxLengthError
    };
  }

  const supabase = await createSupabaseServerClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: copy.submitError
    };
  }

  if (user.id === targetUserId) {
    return {
      error: copy.submitError
    };
  }

  const admin = createSupabaseAdminClient();

  try {
    const existingReview = await findTodayCommunityReview({
      admin,
      reviewerUserId: user.id,
      targetUserId
    });

    if (existingReview) {
      return {
        alreadyReviewedToday: true,
        error: copy.alreadyToday
      };
    }
  } catch (error) {
    console.error("createCommunityReviewAction duplicate check failed", {
      reviewerUserId: user.id,
      targetUserId,
      error
    });

    return {
      error: copy.submitError
    };
  }

  const { data: reviewerProfile, error: reviewerProfileError } = (await admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle()) as {
    data: ReviewerProfileRow | null;
    error: { message?: string } | null;
  };

  if (reviewerProfileError) {
    console.error("createCommunityReviewAction reviewer profile lookup failed", {
      reviewerUserId: user.id,
      targetUserId,
      reviewerProfileError
    });
  }

  const createdAt = new Date().toISOString();
  const insertPayload = {
    reviewer_user_id: user.id,
    target_user_id: targetUserId,
    review_text: reviewText,
    reviewer_display_name: reviewerProfile?.display_name ?? "JustTalk user",
    reviewer_avatar_url: reviewerProfile?.avatar_url ?? null,
    created_at: createdAt
  };

  const { data: insertedReview, error: insertError } = (await admin
    .from("community_reviews")
    .insert(insertPayload)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message?: string } | null;
  };

  if (insertError || !insertedReview) {
    console.error("createCommunityReviewAction insert failed", {
      reviewerUserId: user.id,
      targetUserId,
      insertPayload,
      insertError
    });

    return {
      error: copy.submitError
    };
  }

  return {
    successMessage: copy.success,
    createdReview: {
      id: insertedReview.id,
      reviewerUserId: user.id,
      targetUserId,
      reviewText,
      reviewerDisplayName: insertPayload.reviewer_display_name,
      reviewerAvatarUrl: insertPayload.reviewer_avatar_url ?? undefined,
      createdAt: new Date(createdAt).getTime()
    }
  };
}
