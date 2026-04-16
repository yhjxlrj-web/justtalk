"use server";

import type { SendMessageFormState } from "@/lib/messages/action-state";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isChatMessageTooLong, normalizeChatMessageText } from "@/lib/messages/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/messages/messages";

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
  const fileValue = formData.get("image");
  const imageFile = fileValue instanceof File ? fileValue : null;

  if (!chatId) {
    return { error: "Missing chat room information." };
  }

  if (!imageFile || imageFile.size === 0) {
    return { error: "Please choose an image before sending." };
  }

  if (!imageFile.type.startsWith("image/")) {
    return { error: "Only image files can be sent here." };
  }

  const client = await createSupabaseActionClient();
  const authResponse = await client.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return { error: "You need to sign in again before sending an image." };
  }

  const admin = createSupabaseAdminClient();
  const fileExt = imageFile.name.split(".").pop() ?? "jpg";
  const storagePath = `${chatId}/${user.id}/${Date.now()}-${sanitizeFileName(
    imageFile.name || `image.${fileExt}`
  )}`;

  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("chat-attachments")
      .upload(storagePath, arrayBuffer, {
        contentType: imageFile.type,
        upsert: false
      });

    if (uploadError) {
      return {
        error: uploadError.message ?? "We couldn't upload your image. Please try again."
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
      originalText: imageFile.name || "Photo",
      originalLanguage: "",
      messageKind: "image",
      attachmentUrl: publicUrl,
      attachmentName: imageFile.name || "Photo",
      attachmentContentType: imageFile.type
    });

    return {
      success: true,
      message
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't send your image. Please try again."
    };
  }
}
