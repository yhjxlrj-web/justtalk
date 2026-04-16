"use client";

import { memo, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { compressImageForChat } from "@/lib/images/compress-chat-image";
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

  const handleSelectedFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const nextItems = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => {
        const previewUrl = URL.createObjectURL(file);
        activePreviewUrlsRef.current.add(previewUrl);

        return {
          file,
          fileName: file.name,
          previewUrl,
          size: file.size,
          type: file.type
        } satisfies SelectedImageItem;
      });

    if (nextItems.length === 0) {
      return;
    }

    setSubmitError(null);
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

            console.log("chat image compression", {
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
            console.warn("chat image compression fallback to original", {
              fileName: image.fileName,
              error
            });
          }

          const formData = new FormData();
          formData.set("chatId", chatId);
          formData.set("clientMessageId", clientId);
          formData.set("image", uploadFile);

          const result = await sendImageMessageAction(formData);

          if (result.error || !result.message) {
            setSubmitError(result.error ?? "We couldn't send your image. Please try again.");
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
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          handleSelectedFiles(event.target.files);
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
