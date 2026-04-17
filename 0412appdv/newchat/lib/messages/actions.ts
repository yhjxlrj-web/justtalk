"use server";

import type { SendMessageFormState } from "@/lib/messages/action-state";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  isHeicLikeFile,
  isUploadableImageFile,
  resolveUploadImageExtension,
  resolveUploadImageMimeType,
  withNormalizedImageExtension
} from "@/lib/images/image-file-support";
import { isChatMessageTooLong, normalizeChatMessageText } from "@/lib/messages/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/messages/messages";

const MAX_CHAT_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_TOO_LARGE_ERROR = {
  en: "Image is too large to upload. Please choose a smaller photo.",
  es: "La imagen es demasiado grande. Elige una foto mas pequena.",
  ko: "이미지가 너무 커서 업로드할 수 없어요. 더 작은 사진을 선택해 주세요."
} as const;

const IMAGE_TOO_LARGE_ERROR_LOCALIZED = {
  en: "Image is too large to upload. Please choose a smaller photo.",
  es: "La imagen es demasiado grande. Elige una foto mas pequena.",
  ko: "이미지가 너무 커서 업로드할 수 없어요. 더 작은 사진을 선택해 주세요."
} as const;

const UNSUPPORTED_IMAGE_FORMAT_ERROR = {
  en: "Unsupported image format. Please upload JPG, PNG, or WEBP.",
  es: "Formato de imagen no compatible. Sube JPG, PNG o WEBP.",
  ko: "지원되지 않는 이미지 형식입니다. JPG, PNG, WEBP 파일만 업로드할 수 있어요."
} as const;

const IMAGE_CONVERSION_REQUIRED_ERROR = {
  en: "HEIC images must be converted before upload. Please try selecting the image again.",
  es: "Las imagenes HEIC deben convertirse antes de subir. Vuelve a seleccionar la imagen.",
  ko: "HEIC 이미지는 업로드 전에 변환이 필요합니다. 이미지를 다시 선택해 주세요."
} as const;

const IMAGE_UPLOAD_FAILED_ERROR = {
  en: "Image upload failed. Please try again.",
  es: "Error al subir la imagen. Intentalo de nuevo.",
  ko: "이미지 업로드 중 오류가 발생했습니다. 다시 시도해 주세요."
} as const;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
}

export async function sendMessageAction(
  _prevState: SendMessageFormState,
  formData: FormData
): Promise<SendMessageFormState> {
  const chatId = String(formData.get("chatId") ?? "").trim();
  const clientMessageId = String(formData.get("clientMessageId") ?? "").trim();
  const rawMessage = String(formData.get("message") ?? "");
  const locale = String(formData.get("locale") ?? "").trim();
  const dictionary = getDictionary(locale);
  const originalText = normalizeChatMessageText(rawMessage);

  if (!chatId) {
    return { error: "Missing chat room information." };
  }

  if (isChatMessageTooLong(rawMessage)) {
    return { error: dictionary.messageTooLong };
  }

  if (!originalText) {
    return { error: "Please enter a message before sending." };
  }

  const client = await createSupabaseActionClient();
  const authResponse = await client.auth.getUser();
  const user = authResponse.data?.user ?? null;

  console.log("sendMessageAction start", {
    roomId: chatId,
    senderId: user?.id ?? null,
    currentUserId: user?.id ?? null,
    clientId: clientMessageId || null,
    rawMessage
  });

  if (!user) {
    return { error: "You need to sign in again before sending a message." };
  }

  try {
    const message = await sendMessage({
      client,
      chatId,
      clientMessageId: clientMessageId || undefined,
      senderId: user.id,
      originalText: rawMessage,
      locale,
      originalLanguage: ""
    });

    return { success: true, message };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "We couldn't send your message. Please try again.";
    const errorType = errorMessage.includes("Unable to resolve chat participants")
      ? "participant-failure"
      : errorMessage.includes("target language")
        ? "translation-target-failure"
        : errorMessage.includes("Unable to save your message") || errorMessage.includes("row-level")
          ? "message-insert-failure"
          : "unknown-send-failure";

    console.error("sendMessageAction failed", {
      roomId: chatId,
      senderId: user.id,
      clientId: clientMessageId || null,
      rawMessage,
      errorType,
      error
    });

    return {
      error: errorMessage
    };
  }
}

export async function sendImageMessageAction(formData: FormData): Promise<SendMessageFormState> {
  const chatId = String(formData.get("chatId") ?? "").trim();
  const clientMessageId = String(formData.get("clientMessageId") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();
  const normalizedLocale = locale.toLowerCase();
  const localeCode =
    normalizedLocale.startsWith("ko") ? "ko" : normalizedLocale.startsWith("es") ? "es" : "en";
  const fileValue = formData.get("image");
  const imageFile = fileValue instanceof File ? fileValue : null;

  if (!chatId) {
    return { error: "Missing chat room information." };
  }

  if (!imageFile || imageFile.size === 0) {
    return { error: "Please choose an image before sending." };
  }

  if (isHeicLikeFile(imageFile)) {
    return { error: IMAGE_CONVERSION_REQUIRED_ERROR[localeCode] };
  }

  if (!isUploadableImageFile(imageFile)) {
    return { error: UNSUPPORTED_IMAGE_FORMAT_ERROR[localeCode] };
  }

  if (imageFile.size > MAX_CHAT_IMAGE_UPLOAD_BYTES) {
    return {
      error: IMAGE_TOO_LARGE_ERROR_LOCALIZED[localeCode] ?? IMAGE_TOO_LARGE_ERROR[localeCode]
    };
  }

  const normalizedExtension = resolveUploadImageExtension(imageFile);
  const normalizedMimeType = resolveUploadImageMimeType(imageFile);

  if (!normalizedExtension || !normalizedMimeType) {
    return { error: UNSUPPORTED_IMAGE_FORMAT_ERROR[localeCode] };
  }

  const client = await createSupabaseActionClient();
  const authResponse = await client.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return { error: "You need to sign in again before sending an image." };
  }

  const admin = createSupabaseAdminClient();
  const normalizedFileName = withNormalizedImageExtension(
    imageFile.name || `image.${normalizedExtension}`,
    normalizedExtension
  );
  const storagePath = `${chatId}/${user.id}/${Date.now()}-${sanitizeFileName(
    normalizedFileName
  )}`;

  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("chat-attachments")
      .upload(storagePath, arrayBuffer, {
        contentType: normalizedMimeType,
        upsert: false
      });

    if (uploadError) {
      console.error("sendImageMessageAction upload failed", {
        chatId,
        contentType: normalizedMimeType,
        fileName: normalizedFileName,
        senderId: user.id,
        storagePath,
        uploadError
      });
      return {
        error: IMAGE_UPLOAD_FAILED_ERROR[localeCode]
      };
    }

    const {
      data: { publicUrl }
    } = admin.storage.from("chat-attachments").getPublicUrl(storagePath);

    const message = await sendMessage({
      client,
      chatId,
      clientMessageId: clientMessageId || undefined,
      senderId: user.id,
      originalText: normalizedFileName || "Photo",
      originalLanguage: "",
      messageKind: "image",
      attachmentUrl: publicUrl,
      attachmentName: normalizedFileName || "Photo",
      attachmentContentType: normalizedMimeType
    });

    return {
      success: true,
      message
    };
  } catch (error) {
    console.error("sendImageMessageAction failed", {
      chatId,
      error,
      fileName: normalizedFileName,
      mimeType: normalizedMimeType,
      senderId: user.id
    });
    return {
      error: IMAGE_UPLOAD_FAILED_ERROR[localeCode]
    };
  }
}
