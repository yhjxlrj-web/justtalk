"use client";

import { type ChangeEvent, useActionState, useRef, useState } from "react";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { compressImageFile } from "@/lib/images/compress-image";
import { resolveLocale } from "@/lib/i18n/get-dictionary";
import { initialProfileSetupFormState } from "@/lib/profile/action-state";
import { saveProfileSetupAction } from "@/lib/profile/actions";
import { profileCountryOptions, profileLanguageOptions } from "@/lib/profile/options";
import type { UserProfile } from "@/types/profile";
import { PrimaryButton } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";

export function ProfileSetupForm({ profile }: { profile: UserProfile | null }) {
  const locale = useCurrentLocale();
  const auth = getAuthMessages(locale);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoCompressionError, setPhotoCompressionError] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [state, formAction, isPending] = useActionState(
    saveProfileSetupAction,
    initialProfileSetupFormState
  );
  const errors = state?.errors ?? {};
  const handleProfilePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];

    if (!selectedFile) {
      setPhotoCompressionError(null);
      return;
    }

    setPhotoCompressionError(null);
    setIsCompressingPhoto(true);

    try {
      const compressed = await compressImageFile(selectedFile, {
        jpegQuality: 0.82,
        maxDimension: 1440,
        minBypassBytes: 240 * 1024,
        webpQuality: 0.8
      });
      const fileForSubmit = compressed.compressedFile;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(fileForSubmit);
      const mutableInput = input as HTMLInputElement & { files: FileList | null };
      mutableInput.files = dataTransfer.files;
      console.log("profile setup image compression", {
        compressedSize: compressed.compressedSize,
        fileName: selectedFile.name,
        originalSize: compressed.originalSize,
        wasCompressed: compressed.wasCompressed
      });
    } catch (error) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        input.value = "";
        setPhotoCompressionError(auth.setupPhotoTooLarge);
      } else {
        console.warn("profile setup image compression fallback to original", {
          error,
          fileName: selectedFile.name,
          originalSize: selectedFile.size
        });
      }
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  return (
    <GlassCard className="p-6 sm:p-7">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="locale" value={locale} />
        <Input
          id="name"
          name="name"
          label={auth.setupNameLabel}
          placeholder={auth.setupNamePlaceholder}
          defaultValue={profile?.displayName ?? ""}
          error={errors.name ?? ""}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{auth.setupCountryLabel}</span>
            <select
              name="country"
              defaultValue={profile?.country ?? ""}
              aria-invalid={Boolean(errors.country)}
              className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-soft outline-none focus:border-brand-200 focus:ring-2 focus:ring-brand-100"
            >
              <option value="" disabled>
                {auth.setupCountryPlaceholder}
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

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{auth.setupLanguageLabel}</span>
            <select
              name="language"
              defaultValue={profile?.preferredLanguage ? resolveLocale(profile.preferredLanguage) : ""}
              aria-invalid={Boolean(errors.language)}
              className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-soft outline-none focus:border-brand-200 focus:ring-2 focus:ring-brand-100"
            >
              <option value="" disabled>
                {auth.setupLanguagePlaceholder}
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
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-brand-50 text-lg font-semibold text-brand-700 shadow-soft">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={auth.setupPhotoTitle}
                  className="h-full w-full object-cover"
                />
              ) : (
                (profile?.displayName?.charAt(0) || "U").toUpperCase()
              )}
            </div>

            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-ink">{auth.setupPhotoTitle}</p>
              <p className="text-sm leading-6 text-slate-500">{auth.setupPhotoDescription}</p>
              <input
                ref={photoInputRef}
                id="profilePhoto"
                name="profilePhoto"
                type="file"
                accept="image/*"
                onChange={handleProfilePhotoChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-brand-600"
              />
              {isCompressingPhoto ? (
                <span className="block text-xs text-slate-500">{auth.setupSubmitting}</span>
              ) : null}
              {photoCompressionError ? (
                <span className="block text-xs text-rose-500">{photoCompressionError}</span>
              ) : null}
              {errors.photo ? (
                <span className="block text-xs text-rose-500">{errors.photo}</span>
              ) : null}
            </div>
          </div>
        </div>

        {errors.form ? (
          <div className="rounded-[24px] border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-600">
            {errors.form}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-slate-600">
            {auth.setupInfo}
          </div>
        )}

        <PrimaryButton type="submit" className="w-full sm:w-auto" disabled={isPending || isCompressingPhoto}>
          {isPending ? auth.setupSubmitting : auth.setupCta}
        </PrimaryButton>
      </form>
    </GlassCard>
  );
}
