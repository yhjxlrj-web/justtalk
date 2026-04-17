"use client";

import { memo, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { compressImageForChat } from "@/lib/images/compress-chat-image";
import {
  getImageFileExtension,
  isHeicLikeFile,
  isSupportedImageInput
} from "@/lib/images/image-file-support";
import { normalizeSelectedImage } from "@/lib/images/normalize-selected-image";
import { initialSendMessageFormState } from "@/lib/messages/action-state";
import { sendImageMessageAction, sendMessageAction } from "@/lib/messages/actions";
import {
  CHAT_MESSAGE_WARNING_THRESHOLD,
  getChatMessageCharacterCount,
  isChatMessageTooLong,
  MAX_CHAT_MESSAGE_LENGTH
} from "@/lib/messages/constants";

type SelectedImageItem = {
  file: File;
  fileName: string;
  previewUrl: string;
  size: number;
  type: string;
};

const MAX_ORIGINAL_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_TOO_LARGE_ERROR = {
  en: "Image is too large to upload. Please choose a smaller photo.",
  es: "La imagen es demasiado grande. Elige una foto mas pequena.",
  ko: "이미지가 너무 커서 업로드할 수 없어요. 더 작은 사진을 선택해 주세요."
} as const;

const UNSUPPORTED_IMAGE_FORMAT_ERROR = {
  en: "Unsupported image format. Please use JPG, PNG, WEBP, or HEIC/HEIF.",
  es: "Formato de imagen no compatible. Usa JPG, PNG, WEBP o HEIC/HEIF.",
  ko: "지원되지 않는 이미지 형식입니다. JPG, PNG, WEBP, HEIC/HEIF 파일을 사용해 주세요."
} as const;

const IMAGE_CONVERSION_FAILED_ERROR = {
  en: "We couldn't convert this HEIC image. Please choose a different image.",
  es: "No pudimos convertir esta imagen HEIC. Elige otra imagen.",
  ko: "HEIC 이미지를 변환하지 못했습니다. 다른 이미지를 선택해 주세요."
} as const;

const IMAGE_PREVIEW_FAILED_ERROR = {
  en: "Image preview failed. Please choose another image.",
  es: "No se pudo mostrar la vista previa. Elige otra imagen.",
  ko: "이미지 미리보기에 실패했습니다. 다른 이미지를 선택해 주세요."
} as const;

const IMAGE_UPLOAD_FAILED_ERROR = {
  en: "Image upload failed. Please try again.",
  es: "Error al subir la imagen. Intentalo de nuevo.",
  ko: "이미지 업로드 중 오류가 발생했습니다. 다시 시도해 주세요."
} as const;

function resolveLocaleCode(locale: string): "en" | "es" | "ko" {
  const normalizedLocale = locale.toLowerCase();

  if (normalizedLocale.startsWith("ko")) {
    return "ko";
  }

  if (normalizedLocale.startsWith("es")) {
    return "es";
  }

  return "en";
}

function logChatImageDebug(phase: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.log(`[chat-image] ${phase}`, payload);
}

export const ChatComposer = memo(function ChatComposer({
  chatId,
  disabled = false,
  senderLanguage,
  onOptimisticSend,
  onSendFailed,
  onSendSucceeded
}: {
  chatId: string;
  disabled?: boolean;
  senderLanguage?: string;
  onOptimisticSend: (message: {
    id: string;
    clientId: string;
    body: string;
    originalText: string;
    attachmentContentType?: string;
    attachmentName?: string;
    imageUrl?: string;
    messageType?: "text" | "image";
    canRetry?: boolean;
    senderLanguage?: string;
    createdAt: string;
  }) => void;
  onSendFailed: (tempId: string) => void;
  onSendSucceeded: (
    tempId: string,
    message: {
      id: string;
      clientId?: string;
      attachmentContentType?: string;
      attachmentName?: string;
      imageUrl?: string;
      messageType?: "text" | "image";
      originalText: string;
      originalLanguage: string;
      targetLanguage?: string;
      createdAt: string;
    }
  ) => void;
}) {
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const localeCode = resolveLocaleCode(locale);
  const [message, setMessage] = useState("");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImageItem[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sendingCount, setSendingCount] = useState(0);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isActionButtonPressed, setIsActionButtonPressed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activePreviewUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setAttachmentMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    const activePreviewUrls = activePreviewUrlsRef.current;

    return () => {
      for (const previewUrl of activePreviewUrls) {
        URL.revokeObjectURL(previewUrl);
      }
      activePreviewUrls.clear();
    };
  }, []);

  const releasePreviewUrls = (items: SelectedImageItem[]) => {
    for (const item of items) {
      if (activePreviewUrlsRef.current.has(item.previewUrl)) {
        URL.revokeObjectURL(item.previewUrl);
        activePreviewUrlsRef.current.delete(item.previewUrl);
      }
    }
  };

  const clearSelectedImages = () => {
    releasePreviewUrls(selectedImages);
    setSelectedImages([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resizeTextarea = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "30px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  };

  const restoreTextareaFocus = () => {
    requestAnimationFrame(() => {
      if (disabled) {
        return;
      }

      textareaRef.current?.focus({ preventScroll: true });
    });
  };

  const handleSelectedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const selectedFiles = Array.from(fileList);
    const nextItems: SelectedImageItem[] = [];
    let hadUnsupportedFile = false;
    let hadConversionFailure = false;

    for (const selectedFile of selectedFiles) {
      const extension = getImageFileExtension(selectedFile.name);
      const supported = isSupportedImageInput(selectedFile);

      logChatImageDebug("file-selected", {
        extension,
        isHeicLikeFile: isHeicLikeFile(selectedFile),
        name: selectedFile.name,
        size: selectedFile.size,
        supported,
        type: selectedFile.type || "(empty)"
      });

      if (!supported) {
        hadUnsupportedFile = true;
        continue;
      }

      try {
        const normalizedFile = await normalizeSelectedImage(selectedFile, {
          jpegQuality: 0.84,
          logScope: "chat"
        });
        const previewUrl = URL.createObjectURL(normalizedFile);
        activePreviewUrlsRef.current.add(previewUrl);

        nextItems.push({
          file: normalizedFile,
          fileName: normalizedFile.name || selectedFile.name,
          previewUrl,
          size: normalizedFile.size,
          type: normalizedFile.type || "image/jpeg"
        });

        logChatImageDebug("file-normalized", {
          name: normalizedFile.name,
          originalName: selectedFile.name,
          originalSize: selectedFile.size,
          originalType: selectedFile.type || "(empty)",
          size: normalizedFile.size,
          type: normalizedFile.type || "(empty)"
        });
      } catch (error) {
        hadConversionFailure = true;
        logChatImageDebug("normalize-failed", {
          error,
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type || "(empty)"
        });
      }
    }

    if (nextItems.length === 0) {
      if (hadConversionFailure) {
        setSubmitError(IMAGE_CONVERSION_FAILED_ERROR[localeCode]);
      } else if (hadUnsupportedFile) {
        setSubmitError(UNSUPPORTED_IMAGE_FORMAT_ERROR[localeCode]);
      }
      return;
    }

    if (hadConversionFailure) {
      setSubmitError(IMAGE_CONVERSION_FAILED_ERROR[localeCode]);
    } else if (hadUnsupportedFile) {
      setSubmitError(UNSUPPORTED_IMAGE_FORMAT_ERROR[localeCode]);
    } else {
      setSubmitError(null);
    }

    setSelectedImages((current) => [...current, ...nextItems]);
  };

  const handleSendSelectedImages = async () => {
    if (selectedImages.length === 0 || isUploadingImages || disabled) {
      return;
    }

    setSubmitError(null);
    setAttachmentMenuOpen(false);
    setIsUploadingImages(true);

    const imagesToSend = [...selectedImages];
    setSelectedImages([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      await Promise.all(
        imagesToSend.map(async (image) => {
          const clientId =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const optimisticMessage = {
            id: `temp-${clientId}`,
            clientId,
            body: image.fileName || "Photo",
            originalText: image.fileName || "Photo",
            attachmentContentType: image.type,
            attachmentName: image.fileName,
            imageUrl: image.previewUrl,
            messageType: "image" as const,
            canRetry: false,
            senderLanguage,
            createdAt: new Date().toISOString()
          };

          flushSync(() => {
            onOptimisticSend(optimisticMessage);
          });

          let uploadFile = image.file;

          try {
            const compressionResult = await compressImageForChat(image.file);
            uploadFile = compressionResult.compressedFile;

            logChatImageDebug("compression-success", {
              fileName: image.fileName,
              originalSize: compressionResult.originalSize,
              compressedSize: compressionResult.compressedSize,
              compressionRatio:
                compressionResult.originalSize > 0
                  ? Number(
                      (compressionResult.compressedSize / compressionResult.originalSize).toFixed(3)
                    )
                  : 1,
              width: compressionResult.width,
              height: compressionResult.height,
              mimeType: compressionResult.mimeType
            });
          } catch (error) {
            if (image.file.size > MAX_ORIGINAL_IMAGE_UPLOAD_BYTES) {
              logChatImageDebug("compression-failed-too-large", {
                fileName: image.fileName,
                originalSize: image.file.size,
                limit: MAX_ORIGINAL_IMAGE_UPLOAD_BYTES,
                error
              });
              setSubmitError(IMAGE_TOO_LARGE_ERROR[localeCode]);
              onSendFailed(optimisticMessage.id);
              return;
            }

            logChatImageDebug("compression-fallback-original", {
              fileName: image.fileName,
              originalSize: image.file.size,
              error
            });
          }

          const formData = new FormData();
          formData.set("chatId", chatId);
          formData.set("clientMessageId", clientId);
          formData.set("locale", locale);
          formData.set("image", uploadFile);

          const result = await sendImageMessageAction(formData);

          if (result.error || !result.message) {
            setSubmitError(result.error ?? IMAGE_UPLOAD_FAILED_ERROR[localeCode]);
            logChatImageDebug("upload-failed", {
              error: result.error ?? null,
              fileName: uploadFile.name,
              size: uploadFile.size,
              type: uploadFile.type || "(empty)"
            });
            onSendFailed(optimisticMessage.id);
            return;
          }

          onSendSucceeded(optimisticMessage.id, result.message);

          if (activePreviewUrlsRef.current.has(image.previewUrl)) {
            URL.revokeObjectURL(image.previewUrl);
            activePreviewUrlsRef.current.delete(image.previewUrl);
          }
        })
      );
    } finally {
      setIsUploadingImages(false);
      releasePreviewUrls(imagesToSend);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sendClickAt = performance.now();
    const trimmedMessage = message.trim();

    console.log("send click", {
      chatId,
      at: sendClickAt,
      rawMessage: message
    });

    if (!trimmedMessage) {
      return;
    }

    if (isMessageTooLong) {
      setSubmitError(dictionary.messageTooLong);
      restoreTextareaFocus();
      return;
    }

    const clientId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `client-${Date.now()}`;
    const optimisticMessage = {
      id: `temp-${clientId}`,
      clientId,
      body: trimmedMessage,
      originalText: trimmedMessage,
      senderLanguage,
      createdAt: new Date().toISOString()
    };

    console.log("optimistic append start", {
      chatId,
      clientId,
      at: performance.now(),
      deltaFromClick: performance.now() - sendClickAt
    });

    flushSync(() => {
      setSubmitError(null);
      setMessage("");
      onOptimisticSend(optimisticMessage);
    });

    if (textareaRef.current) {
      textareaRef.current.style.height = "30px";
    }

    restoreTextareaFocus();

    setSendingCount((current) => current + 1);

    const formData = new FormData();
    formData.set("chatId", chatId);
    formData.set("clientMessageId", clientId);
    formData.set("message", message);
    formData.set("locale", locale);

    console.log("sendMessageAction start", {
      chatId,
      clientId,
      at: performance.now(),
      deltaFromClick: performance.now() - sendClickAt
    });

    try {
      const result = await sendMessageAction(initialSendMessageFormState, formData);

      console.log("sendMessageAction resolved", {
        chatId,
        clientId,
        at: performance.now(),
        deltaFromClick: performance.now() - sendClickAt,
        success: !!result.success,
        hasMessage: !!result.message,
        error: result.error ?? null
      });

      if (result.error || !result.message) {
        setSubmitError(result.error ?? "We couldn't send your message. Please try again.");
        onSendFailed(optimisticMessage.id);
        return;
      }

      onSendSucceeded(optimisticMessage.id, result.message);
    } finally {
      setSendingCount((current) => Math.max(0, current - 1));
      restoreTextareaFocus();
    }
  };

  const hasTypedMessage = message.trim().length > 0;
  const messageCharacterCount = getChatMessageCharacterCount(message);
  const isMessageTooLong = isChatMessageTooLong(message);
  const isNearMessageLimit =
    !isMessageTooLong && messageCharacterCount >= CHAT_MESSAGE_WARNING_THRESHOLD;
  const actionButtonClassName = [
    "h-[30px] min-w-[58px] shrink-0 rounded-full px-3 font-medium transform-gpu transition-[transform,box-shadow] duration-100 shadow-float",
    isActionButtonPressed ? "scale-[0.94] translate-y-[1.5px] shadow-none" : "scale-100 translate-y-0 shadow-float",
    hasTypedMessage ? "text-[13px]" : "text-[16px] leading-none"
  ].join(" ");
  const handleActionButtonPressStart = () => setIsActionButtonPressed(true);
  const handleActionButtonPressEnd = () => setIsActionButtonPressed(false);
  const handleActionButtonPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleActionButtonPressStart();
  };
  const handleActionButtonPointerUp = () => {
    handleActionButtonPressEnd();
    restoreTextareaFocus();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleSelectedFiles(event.target.files);
        }}
      />

      {submitError ? (
        <div className="mb-1 rounded-[16px] border border-rose-100 bg-rose-50 px-3 py-2 text-[13px] text-rose-600">
          {submitError}
        </div>
      ) : null}

      {selectedImages.length > 0 ? (
        <div className="mb-2 rounded-[18px] border border-slate-200 bg-white p-2 shadow-soft">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-slate-600">
              {selectedImages.length} selected
            </p>
            <div className="flex items-center gap-2">
              <SecondaryButton
                type="button"
                className="h-8 rounded-full px-3 py-0 text-[12px]"
                onClick={clearSelectedImages}
                disabled={isUploadingImages}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                type="button"
                className="h-8 rounded-full px-3 py-0 text-[12px]"
                onClick={() => {
                  void handleSendSelectedImages();
                }}
                disabled={isUploadingImages}
              >
                {isUploadingImages ? dictionary.sending : dictionary.send}
              </PrimaryButton>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedImages.map((image) => (
              <div
                key={`${image.fileName}-${image.size}-${image.previewUrl}`}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] border border-slate-200 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt={image.fileName}
                  className="h-full w-full object-cover"
                  onError={() => {
                    logChatImageDebug("preview-error", {
                      fileName: image.fileName,
                      size: image.size,
                      type: image.type || "(empty)"
                    });
                    setSubmitError(IMAGE_PREVIEW_FAILED_ERROR[localeCode]);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 bg-transparent p-0">
        <textarea
          ref={textareaRef}
          name="message"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (submitError) {
              setSubmitError(null);
            }
            requestAnimationFrame(resizeTextarea);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && message.trim() && !isMessageTooLong) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className={[
            "h-[30px] flex-1 resize-none select-text rounded-full border bg-white px-3 text-[13px] leading-[30px] text-slate-800 shadow-soft outline-none placeholder:text-slate-400",
            isMessageTooLong ? "border-rose-300 text-rose-700 placeholder:text-rose-300" : "border-slate-200"
          ].join(" ")}
          placeholder={dictionary.typing}
          disabled={disabled}
          style={{
            userSelect: "text",
            WebkitUserSelect: "text"
          }}
        />

        <div ref={menuRef} className="relative shrink-0">
          {attachmentMenuOpen ? (
            <div className="absolute bottom-10 right-0 z-20 min-w-[92px] rounded-[16px] border border-slate-200 bg-[rgb(var(--surface-strong))] p-1.5 shadow-soft">
              <button
                type="button"
                className="flex w-full items-center justify-start rounded-[12px] px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  setAttachmentMenuOpen(false);
                  fileInputRef.current?.click();
                }}
              >
                사진
              </button>
            </div>
          ) : null}

          {hasTypedMessage ? (
            <PrimaryButton
              type="submit"
              className={actionButtonClassName}
              disabled={disabled || isMessageTooLong}
              onPointerCancel={handleActionButtonPressEnd}
              onPointerDown={handleActionButtonPointerDown}
              onPointerLeave={handleActionButtonPressEnd}
              onPointerUp={handleActionButtonPointerUp}
            >
              {sendingCount > 0 ? dictionary.sending : dictionary.send}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              type="button"
              aria-label="Add attachment"
              className={actionButtonClassName}
              onClick={() => setAttachmentMenuOpen((current) => !current)}
              disabled={disabled || isUploadingImages}
              onPointerCancel={handleActionButtonPressEnd}
              onPointerDown={handleActionButtonPointerDown}
              onPointerLeave={handleActionButtonPressEnd}
              onPointerUp={handleActionButtonPointerUp}
            >
              +
            </PrimaryButton>
          )}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between px-1 text-[11px] leading-none">
        <span className={isMessageTooLong ? "text-rose-500" : "text-transparent"}>
          {isMessageTooLong ? dictionary.messageTooLong : "."}
        </span>
        <span
          className={[
            "tabular-nums",
            isMessageTooLong
              ? "text-rose-500"
              : isNearMessageLimit
                ? "text-amber-500"
                : "text-slate-400"
          ].join(" ")}
        >
          {messageCharacterCount} / {MAX_CHAT_MESSAGE_LENGTH}
        </span>
      </div>
    </form>
  );
});
