"use client";

import { useEffect, useState } from "react";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { SecondaryButton } from "@/components/ui/button";
import { getLocaleLabel } from "@/lib/i18n/get-dictionary";
import { getUiCopy } from "@/lib/i18n/ui-copy";
import type { UserProfile } from "@/types/profile";

export function ProfileCard({ profile }: { profile: UserProfile | null }) {
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(profile);

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  const initials = (currentProfile?.displayName?.trim().charAt(0) || "U").toUpperCase();

  return (
    <>
      <div className="rounded-[18px] border border-slate-200 bg-[rgb(var(--surface-strong))] p-3.5 shadow-soft">
        <div className="space-y-4">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-brand-50 text-3xl font-semibold text-brand-700 shadow-sm">
              {currentProfile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentProfile.avatarUrl}
                  alt="Profile avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">{dictionary.myProfile}</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
                {currentProfile?.displayName || copy.profile.completeProfile}
              </h2>
              <p
                className={[
                  "mt-2 max-w-xs text-sm leading-5 sm:text-[15px]",
                  currentProfile?.statusMessage ? "text-slate-600" : "text-slate-400"
                ].join(" ")}
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden"
                }}
              >
                {currentProfile?.statusMessage || copy.profile.statusPlaceholder}
              </p>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-soft">
              {currentProfile?.country || copy.profile.countryPending}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-soft">
              {currentProfile?.preferredLanguage
                ? getLocaleLabel(currentProfile.preferredLanguage)
                : copy.profile.languagePending}
            </span>
          </div>

          <SecondaryButton
            type="button"
            className="mt-5 w-full rounded-[16px] border-slate-200 bg-white px-4 py-3 text-sm font-medium text-brand-700 shadow-soft hover:bg-slate-50 sm:text-base"
            onClick={() => setIsEditProfileOpen(true)}
          >
            {dictionary.editProfile}
          </SecondaryButton>
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSaved={setCurrentProfile}
        profile={currentProfile}
      />
    </>
  );
}
