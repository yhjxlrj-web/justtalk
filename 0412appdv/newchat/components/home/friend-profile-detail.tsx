"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { getLocaleLabel } from "@/lib/i18n/get-dictionary";
import { getUiCopy } from "@/lib/i18n/ui-copy";
import { formatCountryLocalTime } from "@/lib/profile/country-local-time";
import type { FriendListItem } from "@/types/friends";

const SHEET_TRANSITION_MS = 200;

export function FriendProfileDetail({
  bottomContent,
  friend,
  onClose,
  showCountryLocalTime = false
}: {
  bottomContent?: React.ReactNode;
  friend: FriendListItem | null;
  onClose: () => void;
  showCountryLocalTime?: boolean;
}) {
  const [displayedFriend, setDisplayedFriend] = useState<FriendListItem | null>(friend);
  const [isVisible, setIsVisible] = useState(false);
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);

  const requestClose = useCallback(() => {
    setIsVisible(false);
    window.setTimeout(() => {
      onClose();
    }, SHEET_TRANSITION_MS);
  }, [onClose]);

  useEffect(() => {
    if (!friend) {
      setIsVisible(false);
      const timer = window.setTimeout(() => {
        setDisplayedFriend(null);
      }, SHEET_TRANSITION_MS);

      return () => window.clearTimeout(timer);
    }

    setDisplayedFriend(friend);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const rafId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [friend, requestClose]);

  if (!displayedFriend) {
    return null;
  }

  const country = displayedFriend.profile.country || copy.profile.countryPending;
  const language = displayedFriend.profile.preferredLanguage
    ? getLocaleLabel(displayedFriend.profile.preferredLanguage)
    : copy.profile.languagePending;
  const countryLocalTimeLabel = showCountryLocalTime
    ? formatCountryLocalTime(displayedFriend.profile.country, locale)
    : null;
  const closeProfileLabel = `${dictionary.close} ${dictionary.profile}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/18 px-0 pt-12">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={closeProfileLabel}
        data-android-back-close="true"
        onClick={requestClose}
      />

      <div
        className={[
          "relative z-10 w-full max-w-md rounded-t-[30px] border border-slate-200 bg-[rgb(var(--surface-strong))] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] transform-gpu transition-[transform,opacity] duration-200 ease-out sm:mb-4 sm:rounded-[30px] sm:px-5",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        ].join(" ")}
      >
        <div className="flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="mt-2.5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[18px] font-semibold text-ink sm:text-[19px]">
              {dictionary.viewProfile}
            </h3>
          </div>

          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            onClick={requestClose}
            aria-label={closeProfileLabel}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3.5">
          <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-brand-50 text-[22px] font-semibold text-brand-700">
            {displayedFriend.profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayedFriend.profile.avatarUrl}
                alt={`${displayedFriend.profile.displayName} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              (displayedFriend.profile.displayName.charAt(0) || "F").toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="truncate text-[26px] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
              {displayedFriend.profile.displayName || copy.profile.completeProfile}
            </h4>
            {countryLocalTimeLabel ? (
              <p className="mt-1 text-[12px] text-slate-500 sm:text-[13px]">
                {countryLocalTimeLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3.5 rounded-[20px] border border-slate-200 bg-white px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            {copy.editProfile.statusLabel}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-ink">
            {displayedFriend.profile.statusMessage || copy.profile.statusEmpty}
          </p>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          <InfoChip label={country} />
          <InfoChip label={language} />
        </div>

        {bottomContent}
      </div>
    </div>
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
      {label}
    </span>
  );
}
