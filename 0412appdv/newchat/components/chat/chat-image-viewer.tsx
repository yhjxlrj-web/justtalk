"use client";

import { Capacitor } from "@capacitor/core";
import { Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Media } from "@capacitor-community/media";
import type { ChatMessage } from "@/types/chat";

const JUSTTALK_ALBUM_NAME = "JustTalk";

export function ChatImageViewer({
  message,
  onClose
}: {
  message: ChatMessage | null;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) {
      return;
    }

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElementRef.current?.focus();
    };
  }, [message, onClose]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  if (!message?.imageUrl) {
    return null;
  }

  const showSaveStatus = (text: string) => {
    setSaveStatusMessage(text);

    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
    }

    statusTimerRef.current = window.setTimeout(() => {
      setSaveStatusMessage(null);
      statusTimerRef.current = null;
    }, 1800);
  };

  const ensureNativeAlbumIdentifier = async () => {
    const albumResponse = await Media.getAlbums();
    const existingAlbum = albumResponse.albums.find((album) => album.name === JUSTTALK_ALBUM_NAME);

    if (existingAlbum?.identifier) {
      return existingAlbum.identifier;
    }

    await Media.createAlbum({ name: JUSTTALK_ALBUM_NAME });

    const refreshedAlbums = await Media.getAlbums();
    return (
      refreshedAlbums.albums.find((album) => album.name === JUSTTALK_ALBUM_NAME)?.identifier ??
      undefined
    );
  };

  const handleSaveImage = async () => {
    if (!message.imageUrl || isSavingImage) {
      return;
    }

    setIsSavingImage(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const albumIdentifier = await ensureNativeAlbumIdentifier();

        await Media.savePhoto({
          path: message.imageUrl,
          albumIdentifier,
          fileName: message.attachmentName?.replace(/\.[^.]+$/, "") || `justtalk-image-${message.id}`
        });

        showSaveStatus("저장되었습니다");
        return;
      }

      const response = await fetch(message.imageUrl);

      if (!response.ok) {
        throw new Error("Failed to download image.");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = message.attachmentName || `justtalk-image-${message.id}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);

      showSaveStatus("저장되었습니다");
    } catch (error) {
      console.error("Failed to save image:", error);
      showSaveStatus("저장에 실패했습니다");
    } finally {
      setIsSavingImage(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={message.attachmentName ?? "Image viewer"}
      data-android-back-close="true"
      onClick={onClose}
    >
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          aria-label="Save image"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-60"
          onClick={(event) => {
            event.stopPropagation();
            void handleSaveImage();
          }}
          disabled={isSavingImage}
        >
          <Download className="h-4.5 w-4.5" />
        </button>
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close image viewer"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-2xl leading-none text-white transition hover:bg-slate-800"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="flex max-h-full w-full max-w-5xl flex-col items-center animate-[fade-in_160ms_ease-out]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.imageUrl}
          alt={message.attachmentName ?? "Shared image"}
          className="max-h-[78dvh] w-auto max-w-full rounded-[18px] object-contain"
        />
      </div>

      {saveStatusMessage ? (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white">
          {saveStatusMessage}
        </div>
      ) : null}
    </div>
  );
}
