"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { resolveAuthLocale } from "@/lib/i18n/auth-locale";
import { setServerAuthLocale } from "@/lib/i18n/auth-locale-server";
import { resolveLocale } from "@/lib/i18n/get-dictionary";
import {
  isHeicLikeFile,
  isUploadableImageFile,
  resolveUploadImageExtension,
  resolveUploadImageMimeType,
  withNormalizedImageExtension
} from "@/lib/images/image-file-support";
import { syncPeerSnapshotAcrossChatSummaries } from "@/lib/chats/room-summary";
import type { ProfileSetupFormState } from "@/lib/profile/action-state";
import { getUserProfile, mapProfileRowToUserProfile } from "@/lib/profile/profile";
import { createSupabaseActionClient } from "@/lib/supabase/server";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
}

const PROFILE_PHOTO_UNSUPPORTED_ERROR = {
  en: "Unsupported image format. Please upload JPG, PNG, or WEBP.",
  es: "Formato de imagen no compatible. Sube JPG, PNG o WEBP.",
  ko: "지원되지 않는 이미지 형식입니다. JPG, PNG, WEBP 파일만 업로드할 수 있어요."
} as const;

const PROFILE_PHOTO_CONVERSION_REQUIRED_ERROR = {
  en: "HEIC images must be converted before upload. Please re-select the image.",
  es: "Las imagenes HEIC deben convertirse antes de subir. Vuelve a seleccionar la imagen.",
  ko: "HEIC 이미지는 업로드 전에 변환이 필요합니다. 이미지를 다시 선택해 주세요."
} as const;

const PROFILE_PHOTO_UPLOAD_FAILED_ERROR = {
  en: "Image upload failed. Please try again.",
  es: "Error al subir la imagen. Intentalo de nuevo.",
  ko: "이미지 업로드 중 오류가 발생했습니다. 다시 시도해 주세요."
} as const;

function resolveLocaleCode(locale: string): "en" | "es" | "ko" {
  const resolvedLocale = resolveAuthLocale(locale);

  if (resolvedLocale.startsWith("ko")) {
    return "ko";
  }
  if (resolvedLocale.startsWith("es")) {
    return "es";
  }
  return "en";
}

function validateProfileForm(
  name: string,
  statusMessage: string,
  country: string,
  language: string,
  photo: File | null,
  locale: string
) {
  const auth = getAuthMessages(resolveAuthLocale(locale));
  const localeCode = resolveLocaleCode(locale);
  const errors: ProfileSetupFormState["errors"] = {};

  if (!name.trim()) {
    errors.name = auth.setupNameRequired;
  }

  const statusLines = statusMessage.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (statusMessage.length > 80) {
    errors.statusMessage = auth.setupStatusTooLong;
  } else if (statusLines.length > 2) {
    errors.statusMessage = auth.setupStatusTooManyLines;
  }

  if (!country.trim()) {
    errors.country = auth.setupCountryRequired;
  }

  if (!language.trim()) {
    errors.language = auth.setupLanguageRequired;
  }

  if (photo && photo.size > 5 * 1024 * 1024) {
    errors.photo = auth.setupPhotoTooLarge;
  }

  if (photo && photo.size > 0) {
    if (isHeicLikeFile(photo)) {
      errors.photo = PROFILE_PHOTO_CONVERSION_REQUIRED_ERROR[localeCode];
    } else if (!isUploadableImageFile(photo)) {
      errors.photo = PROFILE_PHOTO_UNSUPPORTED_ERROR[localeCode] || auth.setupPhotoInvalid;
    }
  }

  return errors;
}

async function persistProfile(params: {
  country: string;
  language: string;
  locale: string;
  name: string;
  statusMessage: string;
  photo: File | null;
  supabase: any;
  user: { id: string; email?: string | null };
}) {
  const { country, language, locale, name, statusMessage, photo, supabase, user } = params;
  const auth = getAuthMessages(resolveAuthLocale(locale));
  const localeCode = resolveLocaleCode(locale);
  const existingProfile = await getUserProfile(supabase, user.id);
  let avatarUrl: string | null = existingProfile?.avatarUrl ?? null;

  if (photo) {
    if (isHeicLikeFile(photo)) {
      return {
        error: {
          photo: PROFILE_PHOTO_CONVERSION_REQUIRED_ERROR[localeCode]
        }
      };
    }

    if (!isUploadableImageFile(photo)) {
      return {
        error: {
          photo: PROFILE_PHOTO_UNSUPPORTED_ERROR[localeCode]
        }
      };
    }

    const normalizedExtension = resolveUploadImageExtension(photo);
    const normalizedMimeType = resolveUploadImageMimeType(photo);

    if (!normalizedExtension || !normalizedMimeType) {
      return {
        error: {
          photo: PROFILE_PHOTO_UNSUPPORTED_ERROR[localeCode]
        }
      };
    }

    const normalizedFileName = withNormalizedImageExtension(
      photo.name || `image.${normalizedExtension}`,
      normalizedExtension
    );
    const storagePath = `${user.id}/avatar-${Date.now()}-${sanitizeFileName(normalizedFileName)}`;
    const arrayBuffer = await photo.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storagePath, arrayBuffer, {
        contentType: normalizedMimeType,
        upsert: true
      });

    if (uploadError) {
      console.error("profile avatar upload failed", {
        contentType: normalizedMimeType,
        fileName: normalizedFileName,
        storagePath,
        uploadError,
        userId: user.id
      });
      return {
        error: {
          photo: PROFILE_PHOTO_UPLOAD_FAILED_ERROR[localeCode] ?? auth.setupPhotoInvalid
        }
      };
    }

    const {
      data: { publicUrl }
    } = supabase.storage.from("avatars").getPublicUrl(storagePath);

    avatarUrl = publicUrl;
  }

  const profilePayload = {
    id: user.id,
    display_name: name,
    status_message: statusMessage || null,
    country,
    preferred_language: language,
    avatar_url: avatarUrl,
    profile_completed: true
  };

  const { data: profileRow, error: profileError } = (await supabase
    .from("profiles")
    .upsert(profilePayload, {
      onConflict: "id"
    })
    .select(
      "id, email, display_name, status_message, country, preferred_language, avatar_url, show_last_seen, profile_completed, created_at, updated_at"
    )
    .single()) as {
    data:
      | {
          id: string;
          email: string | null;
          display_name: string | null;
          status_message: string | null;
          country: string | null;
          preferred_language: string | null;
          avatar_url: string | null;
          show_last_seen: boolean;
          profile_completed: boolean;
          created_at: string;
          updated_at: string;
        }
      | null;
    error: { message?: string } | null;
  };

  if (profileError || !profileRow) {
    return {
      error: {
        form: profileError?.message ?? auth.setupSaveError
      }
    };
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      display_name: name,
      status_message: statusMessage || null,
      country,
      preferred_language: language,
      profile_completed: true,
      setup_completed: true,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {})
    }
  });

  if (metadataError) {
    return {
      error: {
        form: metadataError.message ?? auth.setupMetadataError
      }
    };
  }

  const { error: participantLanguageError } = await supabase
    .from("chat_participants")
    .update({
      preferred_language_snapshot: language,
      display_name_snapshot: profileRow.display_name ?? name,
      email_snapshot: profileRow.email ?? user.email ?? null,
      avatar_url_snapshot: profileRow.avatar_url ?? avatarUrl ?? null
    })
    .eq("user_id", user.id);

  if (participantLanguageError) {
    return {
      error: {
        form: participantLanguageError.message ?? auth.setupParticipantRefreshError
      }
    };
  }

  await syncPeerSnapshotAcrossChatSummaries({
    userId: user.id,
    displayName: profileRow.display_name ?? name,
    avatarUrl: profileRow.avatar_url ?? avatarUrl ?? null,
    preferredLanguage: profileRow.preferred_language ?? language
  });

  return {
    profile: mapProfileRowToUserProfile(profileRow)
  };
}

export async function saveProfileSetupAction(
  _prevState: ProfileSetupFormState,
  formData: FormData
): Promise<ProfileSetupFormState> {
  const locale = resolveAuthLocale(String(formData.get("locale") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const statusMessage = String(formData.get("statusMessage") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const rawLanguage = String(formData.get("language") ?? "").trim();
  const language = rawLanguage ? resolveLocale(rawLanguage) : "";
  const photoValue = formData.get("profilePhoto");
  const photo = photoValue instanceof File && photoValue.size > 0 ? photoValue : null;

  const errors = validateProfileForm(name, statusMessage, country, language, photo, locale);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  await setServerAuthLocale(locale);

  const supabase = await createSupabaseActionClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    redirect(`/login?lang=${locale}`);
  }

  const result = await persistProfile({
    name,
    statusMessage,
    country,
    language,
    locale,
    photo,
    supabase,
    user
  });

  if (result.error) {
    return { errors: result.error };
  }

  revalidatePath("/home");
  revalidatePath("/profile/setup");
  revalidatePath("/setup-profile");
  redirect("/home");
}

export async function editProfileAction(
  _prevState: ProfileSetupFormState,
  formData: FormData
): Promise<ProfileSetupFormState> {
  const locale = resolveAuthLocale(String(formData.get("locale") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const statusMessage = String(formData.get("statusMessage") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const rawLanguage = String(formData.get("language") ?? "").trim();
  const language = rawLanguage ? resolveLocale(rawLanguage) : "";
  const photoValue = formData.get("profilePhoto");
  const photo = photoValue instanceof File && photoValue.size > 0 ? photoValue : null;

  const errors = validateProfileForm(name, statusMessage, country, language, photo, locale);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const supabase = await createSupabaseActionClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      errors: {
        form: getAuthMessages(locale).loginUnknownError
      }
    };
  }

  const result = await persistProfile({
    name,
    statusMessage,
    country,
    language,
    locale,
    photo,
    supabase,
    user
  });

  if (result.error) {
    return { errors: result.error };
  }

  revalidatePath("/home");
  revalidatePath("/profile/setup");
  revalidatePath("/setup-profile");

  return {
    errors: {},
    profile: result.profile ?? undefined
  };
}

export async function updateLastSeenVisibilityAction(showLastSeen: boolean) {
  const supabase = await createSupabaseActionClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: "Your session has expired. Please sign in again."
    };
  }

  const { data: profileRow, error: updateError } = (await supabase
    .from("profiles")
    .update({
      show_last_seen: showLastSeen
    })
    .eq("id", user.id)
    .select(
      "id, email, display_name, status_message, country, preferred_language, avatar_url, show_last_seen, profile_completed, created_at, updated_at"
    )
    .single()) as {
    data:
      | {
          id: string;
          email: string | null;
          display_name: string | null;
          status_message: string | null;
          country: string | null;
          preferred_language: string | null;
          avatar_url: string | null;
          show_last_seen: boolean;
          profile_completed: boolean;
          created_at: string;
          updated_at: string;
        }
      | null;
    error: { message?: string } | null;
  };

  if (updateError || !profileRow) {
    return {
      error: updateError?.message ?? "We couldn't update your visibility setting right now."
    };
  }

  revalidatePath("/home");
  revalidatePath("/chat");

  return {
    profile: mapProfileRowToUserProfile(profileRow)
  };
}
