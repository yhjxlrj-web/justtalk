"use client";

import { type ChangeEvent, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Eye, ImagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialEditProfileFormState } from "@/lib/profile/action-state";
import { editProfileAction } from "@/lib/profile/actions";
import { resolveLocale } from "@/lib/i18n/get-dictionary";
import { getUiCopy } from "@/lib/i18n/ui-copy";
import { profileCountryOptions, profileLanguageOptions } from "@/lib/profile/options";
import type { UserProfile } from "@/types/profile";

function getSavedProfileKey(profile: UserProfile) {
  return [
    profile.id,
    profile.updatedAt ?? "",
    profile.displayName,
    profile.statusMessage ?? "",
    profile.avatarUrl ?? "",
    profile.country,
    profile.preferredLanguage
  ].join(":");
}

export function EditProfileModal({
  isOpen,
  onClose,
  onSaved,
  profile
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (profile: UserProfile) => void;
  profile: UserProfile | null;
}) {
  const [state, formAction, isPending] = useActionState(
    editProfileAction,
    initialEditProfileFormState
  );
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState<string | null>(null);
  const errors = state?.errors ?? {};
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoActionRef = useRef<HTMLDivElement | null>(null);
  const handledSavedProfileKeyRef = useRef<string | null>(null);

  const requestClose = useCallback(() => {
    setIsPhotoMenuOpen(false);
    setIsAvatarViewerOpen(false);
    onClose();
  }, [onClose]);

  const currentAvatarUrl = useMemo(
    () => selectedPhotoPreviewUrl ?? profile?.avatarUrl ?? null,
    [profile?.avatarUrl, selectedPhotoPreviewUrl]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();

      if (isAvatarViewerOpen) {
        setIsAvatarViewerOpen(false);
        return;
      }

      if (isPhotoMenuOpen) {
        setIsPhotoMenuOpen(false);
        return;
      }

      requestClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAvatarViewerOpen, isOpen, isPhotoMenuOpen, requestClose]);

  useEffect(() => {
    if (!isPhotoMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!photoActionRef.current?.contains(event.target as Node)) {
        setIsPhotoMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isPhotoMenuOpen]);

  useEffect(() => {
    if (!state?.profile) {
      return;
    }

    const nextSavedProfileKey = getSavedProfileKey(state.profile);

    if (handledSavedProfileKeyRef.current === nextSavedProfileKey) {
      return;
    }

    handledSavedProfileKeyRef.current = nextSavedProfileKey;
    onSaved(state.profile);
    requestClose();
    router.refresh();
  }, [onSaved, requestClose, router, state?.profile]);

  useEffect(() => {
    if (!isOpen) {
      setIsPhotoMenuOpen(false);
      setIsAvatarViewerOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (selectedPhotoPreviewUrl) {
        URL.revokeObjectURL(selectedPhotoPreviewUrl);
      }
    };
  }, [selectedPhotoPreviewUrl]);

  if (!isOpen) {
    return null;
  }

  const avatarInitial = (profile?.displayName?.charAt(0) || "U").toUpperCase();

  const handlePhotoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setSelectedPhotoPreviewUrl((previousPreviewUrl) => {
      if (previousPreviewUrl) {
        URL.revokeObjectURL(previousPreviewUrl);
      }

      return nextPreviewUrl;
    });
    setIsPhotoMenuOpen(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/16 px-0 pb-0 pt-8 sm:p-4">
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          onClick={requestClose}
          aria-label={copy.editProfile.closePanelAria}
        />

        <div className="relative z-10 w-full max-w-xl animate-[sheet-rise_220ms_ease-out] overflow-hidden rounded-t-[28px] border border-slate-200 bg-[rgb(var(--surface-strong))] shadow-[0_-18px_40px_rgba(15,23,42,0.12)] sm:rounded-[28px]">
          <div className="flex justify-center pt-2.5 sm:pt-3">
            <div className="h-1.5 w-11 rounded-full bg-slate-300" />
          </div>

          <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-3 sm:px-6">
            <div>
              <h3 className="text-lg font-semibold text-ink sm:text-xl">{dictionary.editProfile}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{copy.editProfile.subtitle}</p>
            </div>

            <button
              type="button"
              aria-label={copy.editProfile.closeAria}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-soft transition hover:bg-slate-50"
              onClick={requestClose}
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <form action={formAction} className="max-h-[78dvh] overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
            <input type="hidden" name="locale" value={locale} />

            <div className="space-y-5">
              <div
                ref={photoActionRef}
                className="relative rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-soft"
              >
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-brand-50 text-2xl font-semibold text-brand-700 shadow-soft transition hover:scale-[1.01]"
                    onClick={() => setIsPhotoMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={isPhotoMenuOpen}
                  >
                    {currentAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentAvatarUrl}
                        alt="Profile avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      avatarInitial
                    )}
                    <span className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-700 shadow-soft">
                      <Camera className="h-4 w-4" />
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{copy.editProfile.photoTitle}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {copy.editProfile.photoDescription}
                    </p>
                    {errors.photo ? (
                      <span className="mt-2 block text-xs text-rose-500">{errors.photo}</span>
                    ) : null}
                  </div>
                </div>

                {isPhotoMenuOpen ? (
                  <div
                    className="absolute left-8 top-[9.5rem] z-20 min-w-[180px] rounded-[20px] border border-slate-200 bg-[rgb(var(--surface-strong))] p-2 shadow-[0_20px_45px_rgba(15,23,42,0.14)]"
                    role="menu"
                    aria-label={copy.editProfile.photoMenuAria}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-[16px] px-3 py-2.5 text-left text-sm text-ink transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => {
                        setIsAvatarViewerOpen(true);
                        setIsPhotoMenuOpen(false);
                      }}
                      disabled={!currentAvatarUrl}
                    >
                      <Eye className="h-4 w-4 text-brand-700" />
                      {copy.editProfile.viewPhoto}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-[16px] px-3 py-2.5 text-left text-sm text-ink transition hover:bg-slate-50"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4 text-brand-700" />
                      {copy.editProfile.attachPhoto}
                    </button>
                  </div>
                ) : null}

                <input
                  ref={photoInputRef}
                  id="profilePhoto"
                  name="profilePhoto"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelection}
                />
              </div>

              <Input
                id="name"
                name="name"
                label={copy.editProfile.nameLabel}
                placeholder={copy.editProfile.namePlaceholder}
                defaultValue={profile?.displayName ?? ""}
                error={errors.name ?? ""}
              />

              <label className="block space-y-2" htmlFor="statusMessage">
                <span className="text-sm font-medium text-slate-700">{copy.editProfile.statusLabel}</span>
                <textarea
                  id="statusMessage"
                  name="statusMessage"
                  rows={2}
                  maxLength={80}
                  defaultValue={profile?.statusMessage ?? ""}
                  placeholder={copy.editProfile.statusPlaceholder}
                  aria-invalid={Boolean(errors.statusMessage)}
                  className="min-h-[78px] w-full resize-none rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-ink shadow-soft outline-none transition placeholder:text-slate-400 focus:border-brand-200 focus:ring-2 focus:ring-brand-100"
                />
                {errors.statusMessage ? (
                  <span className="block text-xs text-rose-500">{errors.statusMessage}</span>
                ) : (
                  <span className="block text-xs text-slate-500">{copy.editProfile.statusHint}</span>
                )}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">{copy.editProfile.languageLabel}</span>
                <select
                  name="language"
                  defaultValue={
                    profile?.preferredLanguage ? resolveLocale(profile.preferredLanguage) : ""
                  }
                  aria-invalid={Boolean(errors.language)}
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-soft outline-none focus:border-brand-200 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="" disabled>
                    {copy.editProfile.languagePlaceholder}
                  </option>
                  {profileLanguageOptions.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </select>
                {errors.language ? (
                  <span className="block text-xs text-rose-500">{errors.language}</span>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">{copy.editProfile.countryLabel}</span>
                <select
                  name="country"
                  defaultValue={profile?.country ?? ""}
                  aria-invalid={Boolean(errors.country)}
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-soft outline-none focus:border-brand-200 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="" disabled>
                    {copy.editProfile.countryPlaceholder}
                  </option>
                  {profileCountryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                {errors.country ? (
                  <span className="block text-xs text-rose-500">{errors.country}</span>
                ) : null}
              </label>

              {errors.form ? (
                <div className="rounded-[22px] border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-600">
                  {errors.form}
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 mt-6 flex gap-3 bg-[rgb(var(--surface-strong))] pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-3">
              <SecondaryButton type="button" className="flex-1" onClick={onClose}>
                {dictionary.cancel}
              </SecondaryButton>
              <PrimaryButton type="submit" className="flex-1" disabled={isPending}>
                {isPending ? copy.editProfile.saving : dictionary.save}
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>

      {isAvatarViewerOpen && currentAvatarUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/82 px-4 py-6"
          onClick={() => setIsAvatarViewerOpen(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800"
            onClick={(event) => {
              event.stopPropagation();
              setIsAvatarViewerOpen(false);
            }}
            aria-label={copy.editProfile.avatarPreviewAria}
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="max-h-full max-w-lg animate-[fade-in_160ms_ease-out]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentAvatarUrl}
              alt="Profile avatar preview"
              className="max-h-[72dvh] w-auto max-w-full rounded-[26px] object-contain shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
