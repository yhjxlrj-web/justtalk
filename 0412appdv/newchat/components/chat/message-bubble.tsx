"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useDictionary } from "@/components/providers/dictionary-provider";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

const REACTION_EMOJIS = ["❤️", "👍", "🤣", "😭", "👌", "🙏"] as const;

export const MessageBubble = memo(function MessageBubble({
  message,
  footerText,
  isSameSenderAsPrev = false,
  isSameSenderAsNext = false,
  showTimestamp = true,
  onOpenImage,
  onToggleReaction,
  onRetryMessage
}: {
  message: ChatMessage;
  footerText?: string | null;
  isSameSenderAsPrev?: boolean;
  isSameSenderAsNext?: boolean;
  showTimestamp?: boolean;
  onOpenImage?: (message: ChatMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string) => Promise<void> | void;
  onRetryMessage?: (messageId: string) => Promise<void> | void;
}) {
  const dictionary = useDictionary();
  const outgoing = message.direction === "outgoing";
  const [showOriginal, setShowOriginal] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const canToggleOriginal =
    !outgoing && !!message.originalBody && message.originalBody !== message.body;
  const canReact = !outgoing && !!onToggleReaction;
  const isImageMessage = message.messageType === "image" && !!message.imageUrl;
  const canOpenImage = isImageMessage && !!onOpenImage;
  const displayBody = showOriginal && canToggleOriginal ? message.originalBody ?? message.body : message.body;
  const showFooter = !!outgoing && !!footerText;
  const isUnreadFooter = showFooter && footerText === dictionary.unread;
  const showTimestampOutside = showTimestamp && !!message.timestamp;
  const reserveFooterSpace = !isImageMessage;

  useEffect(() => {
    setShowOriginal(false);
    setIsReactionPickerOpen(false);
    longPressTriggeredRef.current = false;
  }, [message.id, message.body, message.originalBody]);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    if (!canReact) {
      return;
    }

    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsReactionPickerOpen(true);
    }, 450);
  };

  const handleBubbleClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (canOpenImage) {
      onOpenImage?.(message);
      return;
    }

    if (!canToggleOriginal) {
      return;
    }

    setShowOriginal((current) => !current);
  };

  return (
    <div
      className={cn(
        "message-pop flex px-1",
        outgoing ? "justify-end" : "justify-start",
        isSameSenderAsPrev ? "mt-0.5" : "mt-2.5",
        isSameSenderAsNext ? "mb-1" : "mb-3"
      )}
    >
      <div
        className={cn(
          "flex w-full items-end",
          outgoing ? "justify-end gap-1" : "justify-start gap-1"
        )}
      >
        <div className={cn("flex min-w-0 max-w-[80%] flex-col", outgoing ? "items-end" : "items-start")}>
          <div className="relative">
          {isReactionPickerOpen && canReact ? (
            <div className="absolute -top-14 left-0 z-10 flex items-center gap-1 rounded-full border border-slate-200 bg-[rgb(var(--surface-strong))] px-2 py-2 shadow-soft">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-slate-50"
                  onClick={async (event) => {
                    event.stopPropagation();
                    setIsReactionPickerOpen(false);
                    await onToggleReaction?.(message.id, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          <div
            role={canToggleOriginal || canOpenImage ? "button" : undefined}
            tabIndex={canToggleOriginal || canOpenImage ? 0 : undefined}
            onClick={handleBubbleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerCancel={clearLongPress}
            onContextMenu={(event) => {
              if (!canReact) {
                return;
              }

              event.preventDefault();
              setIsReactionPickerOpen(true);
            }}
            onKeyDown={(event) => {
              if (!canToggleOriginal && !canOpenImage) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleBubbleClick();
              }
            }}
            className={cn(
      "inline-flex w-fit max-w-full flex-col rounded-[16px] px-3 py-1 text-left shadow-soft transition",
      isImageMessage
        ? "min-w-[104px]"
        : "min-w-[63px] min-h-[23px] justify-between sm:min-w-[68px]",
              outgoing
                ? cn(
                  "bg-brand-500 text-white shadow-float",
                    isSameSenderAsPrev ? "rounded-tr-[10px]" : "rounded-tr-[16px]",
                    isSameSenderAsNext ? "rounded-br-[10px]" : "rounded-br-[7px]"
                  )
                : cn(
                    "border border-slate-100 bg-white text-slate-900",
                    isSameSenderAsPrev ? "rounded-tl-[10px]" : "rounded-tl-[16px]",
                    isSameSenderAsNext ? "rounded-bl-[10px]" : "rounded-bl-[7px]"
                  )
            )}
          >
            {isImageMessage ? (
              <div className="flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.imageUrl}
                  alt={message.attachmentName ?? "Shared image"}
                  className={cn(
                    "max-h-64 w-full rounded-[12px] object-cover",
                    canOpenImage ? "cursor-zoom-in" : ""
                  )}
                />
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-keep text-[14px] leading-[1.25] [overflow-wrap:anywhere]">
                {displayBody}
              </p>
            )}

            {reserveFooterSpace ? (
              <div
                className={cn(
                  "mt-0.5 flex min-h-[8px] w-full items-center justify-end gap-1 self-end text-[10px] leading-none",
                  outgoing ? "text-white/95" : "text-slate-400"
                )}
              >
                {showFooter &&
                message.deliveryStatus === "failed" &&
                onRetryMessage &&
                message.canRetry !== false ? (
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-brand-700 transition hover:bg-slate-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onRetryMessage(message.id);
                    }}
                  >
                    재전송
                  </button>
                ) : null}

                {showFooter ? (
                  <span
                    className={cn(
                      "inline-flex min-w-[42px] justify-end text-right whitespace-nowrap",
                      isUnreadFooter ? "text-violet-500" : ""
                    )}
                  >
                    {footerText}
                  </span>
                ) : (
                  <span className="invisible inline-flex min-w-[1px] justify-end text-right whitespace-nowrap">
                    .
                  </span>
                )}
              </div>
            ) : null}
          </div>
          </div>

          {showTimestampOutside ? (
            <p
              className={cn(
                "mt-1 px-1 text-[10px] leading-none text-slate-400",
                outgoing ? "text-right" : "text-left"
              )}
            >
              {message.timestamp}
            </p>
          ) : null}

          {showOriginal && canToggleOriginal ? (
            <p className="mt-0.5 px-1 text-[11px] font-medium text-brand-500">{dictionary.originalLabel}</p>
          ) : null}

          {message.reactions?.length ? (
            <div className="mt-1 flex flex-wrap gap-1.5 px-1">
              {message.reactions.map((reaction) => (
                <button
                  key={`${message.id}-${reaction.emoji}`}
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs shadow-soft transition",
                    reaction.reactedByViewer
                      ? "border-brand-200 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-500"
                  )}
                  onClick={async () => {
                    if (!canReact) {
                      return;
                    }

                    await onToggleReaction?.(message.id, reaction.emoji);
                  }}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
