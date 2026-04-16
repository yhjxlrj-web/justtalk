"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import { PrimaryButton } from "@/components/ui/button";
import { getCachedProfileReviews, patchCachedProfileReviews, setCachedProfileReviews } from "@/components/home/profile-review-cache";
import { createCommunityReviewAction } from "@/lib/reviews/actions";
import { initialCreateCommunityReviewActionState } from "@/lib/reviews/action-state";
import { MAX_COMMUNITY_REVIEW_LENGTH } from "@/lib/reviews/constants";
import { getReviewCopy } from "@/lib/i18n/review-copy";
import { getCommunityReviews } from "@/lib/reviews/reviews";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { CommunityReviewItem } from "@/types/review";

export function ProfileReviewComposer({ targetUserId }: { targetUserId: string }) {
  const locale = useCurrentLocale();
  const copy = getReviewCopy(locale);
  const [reviewText, setReviewText] = useState("");
  const [state, formAction, isPending] = useActionState(
    createCommunityReviewAction,
    initialCreateCommunityReviewActionState
  );
  const isTooLong = reviewText.length > MAX_COMMUNITY_REVIEW_LENGTH;
  const feedbackMessage = state?.successMessage ?? state?.error ?? "";

  useEffect(() => {
    if (!state?.createdReview) {
      return;
    }

    patchCachedProfileReviews(targetUserId, (current) => {
      const alreadyExists = current.some((review) => review.id === state.createdReview?.id);

      if (alreadyExists) {
        return current;
      }

      return [state.createdReview!, ...current].sort((left, right) => right.createdAt - left.createdAt);
    });
    setReviewText("");
  }, [state?.createdReview, targetUserId]);

  return (
    <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        {copy.title}
      </p>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="targetUserId" value={targetUserId} />
        <textarea
          name="reviewText"
          rows={2}
          maxLength={MAX_COMMUNITY_REVIEW_LENGTH}
          value={reviewText}
          onChange={(event) => setReviewText(event.target.value)}
          placeholder={copy.placeholder}
          className={cn(
            "h-[56px] w-full resize-none rounded-[16px] border bg-white px-3.5 py-3 text-sm leading-5 text-ink outline-none transition",
            isTooLong ? "border-rose-300" : "border-slate-200 focus:border-brand-300"
          )}
        />

        <div className="flex items-center justify-between gap-3">
          <p
            className={cn(
              "min-h-[18px] text-[11px] leading-4",
              state?.successMessage
                ? "text-emerald-600"
                : state?.error
                  ? "text-rose-500"
                  : "text-slate-400"
            )}
          >
            {feedbackMessage || `${reviewText.length}/${MAX_COMMUNITY_REVIEW_LENGTH}`}
          </p>

          <PrimaryButton
            type="submit"
            className="h-9 rounded-[12px] px-3 text-[12px] font-semibold"
            disabled={isPending || !reviewText.trim() || isTooLong}
          >
            {copy.button}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

export function ProfileReviewList({ targetUserId }: { targetUserId: string }) {
  const locale = useCurrentLocale();
  const copy = getReviewCopy(locale);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [reviews, setReviews] = useState<CommunityReviewItem[]>(() => getCachedProfileReviews(targetUserId));
  const [isLoading, setIsLoading] = useState(() => getCachedProfileReviews(targetUserId).length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedReviews = getCachedProfileReviews(targetUserId);

    if (cachedReviews.length > 0) {
      setReviews(cachedReviews);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    void getCommunityReviews(supabase, targetUserId)
      .then((items) => {
        if (cancelled) {
          return;
        }

        setCachedProfileReviews(targetUserId, items);
        setReviews(items);
        setError(null);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        console.error("Failed to load profile reviews", {
          targetUserId,
          error: nextError
        });
        setError(copy.loadError);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [copy.loadError, supabase, targetUserId]);

  return (
    <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        {copy.title}
      </p>

      {isLoading ? (
        <div className="mt-3 space-y-2">
          {[0, 1].map((index) => (
            <div key={index} className="flex items-start gap-3 rounded-[16px] bg-slate-50 px-3 py-3">
              <div className="h-9 w-9 animate-pulse rounded-[12px] bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-3 text-sm leading-6 text-rose-500">{error}</p>
      ) : reviews.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-500">{copy.empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="flex items-start gap-3 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-slate-200 bg-brand-50 text-[12px] font-semibold text-brand-700">
                {review.reviewerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.reviewerAvatarUrl}
                    alt={`${review.reviewerDisplayName} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  review.reviewerDisplayName.charAt(0).toUpperCase()
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-ink">{review.reviewerDisplayName}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{review.reviewText}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
