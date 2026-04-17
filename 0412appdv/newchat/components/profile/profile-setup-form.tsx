"use client";

import { type ChangeEvent, useActionState, useRef, useState } from "react";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { compressImageFile } from "@/lib/images/compress-image";
import { isSupportedImageInput } from "@/lib/images/image-file-support";
import { normalizeSelectedImage } from "@/lib/images/normalize-selected-image";
import { resolveLocale } from "@/lib/i18n/get-dictionary";
import { initialProfileSetupFormState } from "@/lib/profile/action-state";
import { saveProfileSetupAction } from "@/lib/profile/actions";
import { profileCountryOptions, profileLanguageOptions } from "@/lib/profile/options";
import type { UserProfile } from "@/types/profile";
import { PrimaryButton } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";

const PROFILE_UNSUPPORTED_IMAGE_ERROR = {
  en: "Unsupported image format. Please use JPG, PNG, WEBP, or HEIC/HEIF.",
  es: "Formato de imagen no compatible. Usa JPG, PNG, WEBP o HEIC/HEIF.",
  ko: "지원되지 않는 이미지 형식입니다. JPG, PNG, WEBP, HEIC/HEIF 파일을 사용해 주세요."
} as const;

const PROFILE_IMAGE_CONVERSION_FAILED_ERROR = {
  en: "We couldn't convert this HEIC image. Please choose a different image.",
  es: "No pudimos convertir esta imagen HEIC. Elige otra imagen.",
  ko: "HEIC 이미지를 변환하지 못했습니다. 다른 이미지를 선택해 주세요."
} as const;

function logProfileSetupImageDebug(phase: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.log(`[profile-setup-image] ${phase}`, payload);
}

export function ProfileSetupForm({ profile }: { profile: UserProfile | null }) {
  const locale = useCurrentLocale();
  const localeCode = locale.startsWith("ko") ? "ko" : locale.startsWith("es") ? "es" : "en";
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

    logProfileSetupImageDebug("file-selected", {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type || "(empty)"
    });

    if (!isSupportedImageInput(selectedFile)) {
      input.value = "";
      setPhotoCompressionError(PROFILE_UNSUPPORTED_IMAGE_ERROR[localeCode]);
      logProfileSetupImageDebug("unsupported-format", {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type || "(empty)"
      });
      return;
    }

    setPhotoCompressionError(null);
    setIsCompressingPhoto(true);

    let normalizedFile: File;

    try {
      normalizedFile = await normalizeSelectedImage(selectedFile, {
        jpegQuality: 0.85,
        logScope: "profile"
      });
    } catch (error) {
      input.value = "";
      setPhotoCompressionError(PROFILE_IMAGE_CONVERSION_FAILED_ERROR[localeCode]);
      logProfileSetupImageDebug("normalize-failed", {
        error,
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type || "(empty)"
      });
      setIsCompressingPhoto(false);
      return;
    }

    try {
      let fileForSubmit = normalizedFile;

      try {
        const compressed = await compressImageFile(normalizedFile, {
          jpegQuality: 0.84,
          maxDimension: 1024,
          minBypassBytes: 220 * 1024,
          webpQuality: 0.8
        });
        fileForSubmit = compressed.compressedFile;
        logProfileSetupImageDebug("compression-success", {
          compressedSize: compressed.compressedSize,
          fileName: normalizedFile.name,
          originalSize: compressed.originalSize,
          wasCompressed: compressed.wasCompressed
        });
      } catch (error) {
        logProfileSetupImageDebug("compression-fallback-normalized", {
          error,
          fileName: normalizedFile.name,
          normalizedSize: normalizedFile.size
        });
      }

      if (fileForSubmit.size > 5 * 1024 * 1024) {
        input.value = "";
        setPhotoCompressionError(auth.setupPhotoTooLarge);
        return;
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(fileForSubmit);
      const mutableInput = input as HTMLInputElement & { files: FileList | null };
      mutableInput.files = dataTransfer.files;
    } catch (error) {
      input.value = "";
      setPhotoCompressionError(PROFILE_IMAGE_CONVERSION_FAILED_ERROR[localeCode]);
      logProfileSetupImageDebug("selection-processing-failed", {
        error,
        fileName: selectedFile.name,
        originalSize: selectedFile.size,
        originalType: selectedFile.type || "(empty)"
      });
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
                accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp"
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
