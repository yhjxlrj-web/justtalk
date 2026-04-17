"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { resolveAuthLocale } from "@/lib/i18n/auth-locale";
import { setServerAuthLocale } from "@/lib/i18n/auth-locale-server";
import { resolveLocale } from "@/lib/i18n/get-dictionary";
import { syncPeerSnapshotAcrossChatSummaries } from "@/lib/chats/room-summary";
import type { ProfileSetupFormState } from "@/lib/profile/action-state";
import { getUserProfile, mapProfileRowToUserProfile } from "@/lib/profile/profile";
import { createSupabaseActionClient } from "@/lib/supabase/server";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
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

  if (photo && photo.size > 0 && !photo.type.startsWith("image/")) {
    errors.photo = auth.setupPhotoInvalid;
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
  const existingProfile = await getUserProfile(supabase, user.id);
  let avatarUrl: string | null = existingProfile?.avatarUrl ?? null;

  if (photo) {
    const fileExt = photo.name.split(".").pop() ?? "jpg";
    const storagePath = `${user.id}/avatar-${Date.now()}-${sanitizeFileName(photo.name || `image.${fileExt}`)}`;
    const arrayBuffer = await photo.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storagePath, arrayBuffer, {
        contentType: photo.type,
        upsert: true
      });

    if (uploadError) {
      return {
        error: {
          photo: uploadError.message ?? auth.setupPhotoInvalid
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
