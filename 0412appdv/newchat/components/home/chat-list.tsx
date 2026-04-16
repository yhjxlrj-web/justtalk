"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { patchCachedChatPreview } from "@/components/home/chat-preview-cache";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { cn } from "@/lib/utils";
import type { ChatRoomPreview } from "@/types/home";

type ChatListProps = {
  chats: ChatRoomPreview[];
  selectedRoomId?: string;
  isLoading?: boolean;
  connectionState?: "connecting" | "connected" | "reconnecting";
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = {
  ko: ["일", "월", "화", "수", "목", "금", "토"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
} as const;

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getLatestMessageWeekdayLabel(
  latestMessageCreatedAt: string | undefined,
  locale: "ko" | "en" | "es"
) {
  if (!latestMessageCreatedAt) {
    return null;
  }

  const now = new Date();
  const latestMessageDate = new Date(latestMessageCreatedAt);
  const latestMessageTime = latestMessageDate.getTime();

  if (Number.isNaN(latestMessageTime)) {
    return null;
  }

  if (isSameCalendarDay(latestMessageDate, now)) {
    return null;
  }

  const diffMs = now.getTime() - latestMessageTime;

  if (diffMs < 0 || diffMs > SEVEN_DAYS_MS) {
    return null;
  }

  return WEEKDAY_LABELS[locale][latestMessageDate.getDay()] ?? null;
}

export function ChatList({
  chats,
  isLoading = false,
  selectedRoomId
}: ChatListProps) {
  if (isLoading) {
    return <ChatListLoadingState />;
  }

  if (chats.length === 0) {
    return <ChatListEmptyState />;
  }

  return (
    <div className="flex min-w-0 h-full min-h-[calc(100dvh-13rem)] w-full flex-col">
      <div className="flex-1 w-full space-y-1.5">
        {chats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            selected={selectedRoomId ? selectedRoomId === chat.roomId : chat.selected}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatListItem({
  chat,
  selected
}: {
  chat: ChatRoomPreview;
  selected?: boolean;
}) {
  const locale = useCurrentLocale();
  const href = `/chat/${chat.roomId}`;
  const recentWeekdayLabel = getLatestMessageWeekdayLabel(
    chat.latestMessageCreatedAt,
    locale
  );

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const nowIso = new Date().toISOString();

    patchCachedChatPreview(chat.roomId, (preview) => ({
      ...preview,
      unreadCount: 0,
      viewerLastSeenAt: nowIso
    }));
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "chat-list-border flex min-w-0 w-full items-center gap-2.5 overflow-hidden rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-inherit no-underline shadow-soft transition hover:bg-slate-50 focus-visible:outline-none",
        selected ? "border-slate-200 bg-white shadow-soft" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[14px] bg-brand-50 text-[13px] font-semibold text-brand-700">
        {chat.recipientAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chat.recipientAvatarUrl}
            alt={`${chat.recipientName} avatar`}
            className="h-full w-full object-cover"
          />
        ) : (
          chat.recipientName.charAt(0)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink sm:text-sm">
              {chat.recipientName}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-slate-500 sm:text-sm">
              {chat.latestMessagePreview}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
            {recentWeekdayLabel ? (
              <p className="text-[10px] font-semibold text-blue-600">{recentWeekdayLabel}</p>
            ) : null}
            <p className="text-[10px] text-slate-400">{chat.latestMessageAt}</p>
            {chat.unreadCount && chat.unreadCount > 0 ? (
              <span className="inline-flex min-w-[1.3rem] items-center justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white shadow-soft">
                {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ChatListEmptyState() {
  const dictionary = useDictionary();

  return (
    <div className="flex min-w-0 h-full min-h-[calc(100dvh-13rem)] w-full flex-col">
      <div className="chat-list-border flex w-full flex-1 items-center justify-center rounded-[16px] border border-slate-200 bg-white px-3.5 py-5 text-center shadow-soft">
        <div>
          <p className="text-[15px] font-semibold text-ink sm:text-base">{dictionary.noMessages}</p>
          <p className="mt-1.5 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
            {dictionary.startConversation}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ChatListLoadingState() {
  return (
    <div className="flex min-w-0 h-full min-h-[calc(100dvh-13rem)] w-full flex-col">
      <div className="flex-1 w-full space-y-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="chat-list-border flex w-full items-center gap-2.5 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 shadow-soft"
          >
            <div className="h-10 w-10 animate-pulse rounded-[14px] bg-brand-100" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="h-3.5 w-28 animate-pulse rounded-full bg-brand-100" />
                <div className="h-3 w-10 animate-pulse rounded-full bg-slate-200" />
              </div>
              <div className="h-3 w-40 animate-pulse rounded-full bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
