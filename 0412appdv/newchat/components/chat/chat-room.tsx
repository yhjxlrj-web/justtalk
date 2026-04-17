"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDictionary } from "@/components/providers/dictionary-provider";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatImageViewer } from "@/components/chat/chat-image-viewer";
import { EmptyConversationState } from "@/components/chat/empty-conversation-state";
import { MessageBubble } from "@/components/chat/message-bubble";
import { RoomHeader } from "@/components/chat/room-header";
import type { ChatMessage, ChatRoomSummary } from "@/types/chat";

export function ChatRoom({
  connectionState = "connected",
  hasResolvedInitialScrollTarget = false,
  hasOlderMessages = false,
  hasRecentMessages = false,
  isInitialRoomLoading = false,
  isOlderMessagesLoading = false,
  isRoomRefreshing = false,
  initialScrollTargetMessageId = null,
  messageStatusMap = {},
  messages,
  onDeleteHistory,
  onLoadOlderMessages,
  onOptimisticSend,
  onQuickSendGreeting,
  onRetryMessage,
  onSendFailed,
  onSendSucceeded,
  onToggleReaction,
  room,
  suppressInitialSkeleton = false
}: {
  connectionState?: "connecting" | "connected" | "reconnecting";
  hasResolvedInitialScrollTarget?: boolean;
  hasOlderMessages?: boolean;
  hasRecentMessages?: boolean;
  isInitialRoomLoading?: boolean;
  isOlderMessagesLoading?: boolean;
  isRoomRefreshing?: boolean;
  initialScrollTargetMessageId?: string | null;
  messageStatusMap?: Record<
    string,
    {
      deliveryStatus: "sending" | "sent" | "failed";
      readStatus: "read" | "unread" | null;
    }
  >;
  room: ChatRoomSummary;
  messages: ChatMessage[];
  suppressInitialSkeleton?: boolean;
  onDeleteHistory: () => void;
  onLoadOlderMessages?: () => void | Promise<void>;
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
  onQuickSendGreeting: (message: string) => void;
  onRetryMessage: (messageId: string) => Promise<void> | void;
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
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
}) {
  const dictionary = useDictionary();
  const messagesViewportRef = useRef<HTMLElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const initialScrollAppliedRef = useRef(false);
  const previousMessageCountRef = useRef(messages.length);
  const pendingPrependRef = useRef<{
    previousMessageCount: number;
    previousScrollHeight: number;
    previousScrollTop: number;
  } | null>(null);
  const messageAnchorElementsRef = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [selectedImageMessage, setSelectedImageMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const updateViewportLayout = () => {
      const nextViewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
      const nextKeyboardInset = Math.max(
        0,
        Math.round(
          window.innerHeight -
            (window.visualViewport?.height ?? window.innerHeight) -
            (window.visualViewport?.offsetTop ?? 0)
        )
      );

      setVisualViewportHeight(nextViewportHeight);
      setKeyboardInset(nextKeyboardInset);
    };

    updateViewportLayout();
    window.visualViewport.addEventListener("resize", updateViewportLayout);
    window.visualViewport.addEventListener("scroll", updateViewportLayout);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportLayout);
      window.visualViewport?.removeEventListener("scroll", updateViewportLayout);
    };
  }, []);

  const roomViewportStyle = useMemo(
    () =>
      visualViewportHeight
        ? {
            height: `${visualViewportHeight}px`
          }
        : undefined,
    [visualViewportHeight]
  );

  useEffect(() => {
    if (!hasResolvedInitialScrollTarget) {
      return;
    }

    if (!initialScrollAppliedRef.current) {
      if (initialScrollTargetMessageId) {
        const anchorElement =
          messageAnchorElementsRef.current.get(initialScrollTargetMessageId) ?? null;

        if (!anchorElement) {
          return;
        }

        requestAnimationFrame(() => {
          anchorElement.scrollIntoView({
            block: "start"
          });
        });
      } else {
        requestAnimationFrame(() => {
          messageEndRef.current?.scrollIntoView({
            block: "end"
          });
        });
      }

      initialScrollAppliedRef.current = true;
      previousMessageCountRef.current = messages.length;
      return;
    }

    const previousMessageCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (messages.length <= previousMessageCount) {
      return;
    }

    const latestMessage = messages[messages.length - 1];

    if (latestMessage?.direction !== "outgoing") {
      return;
    }

    requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({
        block: "end"
      });
    });
  }, [hasResolvedInitialScrollTarget, initialScrollTargetMessageId, messages]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    const sentinel = topSentinelRef.current;

    if (!viewport || !sentinel || !hasOlderMessages || isOlderMessagesLoading || isInitialRoomLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting || !onLoadOlderMessages) {
          return;
        }

        pendingPrependRef.current = {
          previousMessageCount: messages.length,
          previousScrollHeight: viewport.scrollHeight,
          previousScrollTop: viewport.scrollTop
        };
        void onLoadOlderMessages();
      },
      {
        root: viewport,
        threshold: 0.05
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    hasOlderMessages,
    isInitialRoomLoading,
    isOlderMessagesLoading,
    messages.length,
    onLoadOlderMessages
  ]);

  useEffect(() => {
    const pendingPrepend = pendingPrependRef.current;
    const viewport = messagesViewportRef.current;

    if (!pendingPrepend || !viewport || isOlderMessagesLoading) {
      return;
    }

    if (messages.length <= pendingPrepend.previousMessageCount) {
      pendingPrependRef.current = null;
      return;
    }

    requestAnimationFrame(() => {
      const nextScrollHeight = viewport.scrollHeight;
      viewport.scrollTop =
        nextScrollHeight - pendingPrepend.previousScrollHeight + pendingPrepend.previousScrollTop;
      pendingPrependRef.current = null;
    });
  }, [isOlderMessagesLoading, messages.length]);

  const showRoomSkeleton = !suppressInitialSkeleton && !hasRecentMessages && isInitialRoomLoading;
  const showHeaderLoadingIndicator = showRoomSkeleton || isRoomRefreshing;

  return (
    <div
      className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-[rgb(var(--bg))] shadow-none"
      style={roomViewportStyle}
    >
      <RoomHeader room={room} onDeleteHistory={onDeleteHistory} isLoading={showHeaderLoadingIndicator} />

      <main
        ref={messagesViewportRef}
        className="chat-room-pattern flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
        style={{
          scrollPaddingBottom: `${88 + keyboardInset}px`
        }}
      >
        <p className="mb-3 text-center text-[11px] text-slate-400 sm:mb-4 sm:text-xs">
          {connectionState === "connected"
            ? dictionary.liveConnected
            : connectionState === "reconnecting"
              ? dictionary.reconnecting
              : dictionary.connecting}
        </p>
        {showRoomSkeleton ? (
          <div className="space-y-3">
            <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-2 shadow-soft">
              <div className="h-4 w-24 animate-pulse rounded-full bg-brand-100" />
            </div>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className={item % 2 === 0 ? "flex justify-start" : "flex justify-end"}>
                <div className={`max-w-[80%] ${item % 2 === 0 ? "items-start" : "items-end"}`}>
                  <div className="h-12 animate-pulse rounded-[18px] bg-white shadow-soft" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-0">
            <div ref={topSentinelRef} className="h-px w-full" />
            {isOlderMessagesLoading ? (
              <div className="mb-2 flex justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div
                key={message.clientId ?? message.id}
                data-message-anchor={message.id}
                data-unread-anchor={initialScrollTargetMessageId === message.id ? "true" : undefined}
                ref={(element) => {
                  messageAnchorElementsRef.current.set(message.id, element);
                }}
              >
                {(() => {
                  const prevMessage = messages[index - 1];
                  const nextMessage = messages[index + 1];
                  const messageStatusKey = message.clientId ?? message.id;
                  const currentMessageStatus = messageStatusMap[messageStatusKey];
                  const deliveryStatus =
                    currentMessageStatus?.deliveryStatus ??
                    message.deliveryStatus ??
                    (message.direction === "outgoing" ? "sent" : undefined);
                  const readStatus = currentMessageStatus?.readStatus ?? message.readStatus ?? null;
                  const senderKey = message.senderId ?? message.direction;
                  const prevSenderKey = prevMessage?.senderId ?? prevMessage?.direction;
                  const nextSenderKey = nextMessage?.senderId ?? nextMessage?.direction;
                  const isSameSenderAsPrev = !!prevMessage && prevSenderKey === senderKey;
                  const isSameSenderAsNext = !!nextMessage && nextSenderKey === senderKey;
                  const showTimestamp = !isSameSenderAsNext;

                  return (
                    <MessageBubble
                      message={message}
                      isSameSenderAsPrev={isSameSenderAsPrev}
                      isSameSenderAsNext={isSameSenderAsNext}
                      showTimestamp={showTimestamp}
                      footerText={
                        message.direction === "outgoing" && showTimestamp
                          ? deliveryStatus === "sending"
                            ? dictionary.sending
                            : deliveryStatus === "failed"
                              ? dictionary.failedToSend
                              : readStatus === "read"
                              ? dictionary.read
                              : dictionary.unread
                          : null
                      }
                      onOpenImage={message.messageType === "image" ? setSelectedImageMessage : undefined}
                      onRetryMessage={onRetryMessage}
                      onToggleReaction={onToggleReaction}
                    />
                  );
                })()}
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>
        ) : isRoomRefreshing || isInitialRoomLoading ? (
          <div className="h-full min-h-[44vh] sm:min-h-[48vh]" />
        ) : (
          <div className="flex h-full min-h-[44vh] items-center justify-center sm:min-h-[48vh]">
            <EmptyConversationState onQuickSend={onQuickSendGreeting} />
          </div>
        )}
      </main>

      <footer
        className="shrink-0 bg-transparent px-3 py-2 shadow-none"
        style={{
          paddingBottom: "calc(0.35rem + env(safe-area-inset-bottom))"
        }}
      >
        <ChatComposer
          chatId={room.id}
          senderLanguage={room.myLanguage}
          disabled={showRoomSkeleton}
          onOptimisticSend={onOptimisticSend}
          onSendFailed={onSendFailed}
          onSendSucceeded={onSendSucceeded}
        />
      </footer>

      <ChatImageViewer message={selectedImageMessage} onClose={() => setSelectedImageMessage(null)} />
    </div>
  );
}
