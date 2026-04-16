"use client";

import { memo, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { FriendProfileDetail } from "@/components/home/friend-profile-detail";
import { ProfileReviewComposer } from "@/components/home/profile-review-sections";
import { useDictionary } from "@/components/providers/dictionary-provider";
import { useHomeTabs } from "@/components/providers/home-tab-provider";
import { deleteChatHistory, leaveChatRoom } from "@/lib/chats/actions";
import type { ChatRoomSummary } from "@/types/chat";
import type { FriendListItem } from "@/types/friends";

export const RoomHeader = memo(function RoomHeader({
  isLoading = false,
  room,
  onDeleteHistory
}: {
  isLoading?: boolean;
  room: ChatRoomSummary;
  onDeleteHistory?: () => void;
}) {
  const dictionary = useDictionary();
  const router = useRouter();
  const { setActiveTab } = useHomeTabs();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendListItem | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuContentRef = useRef<HTMLDivElement | null>(null);
  const canShowPeerStatus = !room.peerProfile || room.peerProfile.showLastSeen !== false;

  const peerFriend: FriendListItem | null = room.peerProfile
    ? {
        relationship: {
          id: `chat-peer-${room.peerProfile.id}`,
          requesterId: room.peerProfile.id,
          addresseeId: room.peerProfile.id,
          status: "accepted"
        },
        profile: {
          id: room.peerProfile.id,
          email: "",
          displayName: room.peerProfile.displayName,
          statusMessage: room.peerProfile.statusMessage,
          country: room.peerProfile.country,
          preferredLanguage: room.peerProfile.preferredLanguage,
          avatarUrl: room.peerProfile.avatarUrl,
          lastActiveAt: room.peerProfile.showLastSeen ? room.peerProfile.lastSeenAt : undefined,
          showLastSeen: room.peerProfile.showLastSeen
        },
        direction: "incoming"
      }
    : null;

  useEffect(() => {
    setActiveTab("chats");
    router.prefetch("/home?tab=chats");
  }, [router, setActiveTab]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const updateMenuPosition = () => {
      const button = menuButtonRef.current;

      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const menuWidth = 224;
      const viewportPadding = 12;
      const nextLeft = Math.min(
        window.innerWidth - menuWidth - viewportPadding,
        Math.max(viewportPadding, rect.right - menuWidth)
      );
      const nextTop = rect.bottom + 8;

      setMenuPosition({
        top: nextTop,
        left: nextLeft
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  const handleDeleteHistory = async () => {
    if (!window.confirm(dictionary.deleteChatHistoryConfirm)) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteChatHistory(room.id);

      if (result.error) {
        setDeleteError(result.error);
        return;
      }

      setIsMenuOpen(false);
      onDeleteHistory?.();
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeaveChatRoom = async () => {
    if (!window.confirm(dictionary.leaveChatRoomConfirm)) {
      return;
    }

    setIsLeaving(true);
    setLeaveError(null);

    try {
      const result = await leaveChatRoom(room.id);

      if (result.error) {
        setLeaveError(result.error);
        return;
      }

      setIsMenuOpen(false);

      if (result.redirectTo) {
        router.replace(result.redirectTo);
        router.refresh();
      }
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <header className="relative z-20 shrink-0 bg-transparent px-4 py-3 shadow-none">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label={dictionary.back}
            onClick={() => {
              setActiveTab("chats");
              router.replace("/home?tab=chats");
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-soft transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>

          <button
            type="button"
            disabled={!peerFriend}
            onClick={() => {
              if (peerFriend) {
                setSelectedFriend(peerFriend);
              }
            }}
            className="flex min-w-0 items-center gap-3 text-left disabled:cursor-default"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[16px] bg-brand-50 text-[13px] font-semibold text-brand-700 sm:h-11 sm:w-11 sm:text-sm">
              {room.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={room.avatarUrl}
                  alt={`${room.name} profile`}
                  className="h-full w-full object-cover"
                />
              ) : (
                room.name.charAt(0)
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink sm:text-base">{room.name}</p>
              {canShowPeerStatus && room.topic ? (
                <p className="mt-0.5 truncate text-[12px] text-slate-500 sm:mt-1 sm:text-sm">
                  {room.topic}
                </p>
              ) : null}
            </div>
          </button>
        </div>

        <div className="relative shrink-0">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500"
              />
            ) : null}

            <button
              ref={menuButtonRef}
              type="button"
              aria-label={dictionary.more}
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-slate-500 shadow-soft transition hover:bg-slate-50 sm:h-10 sm:w-10"
            >
              <span aria-hidden>...</span>
            </button>
          </div>

        </div>
      </div>

      {isMenuOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[140]">
              <button
                type="button"
                aria-label={dictionary.close}
                className="absolute inset-0 cursor-default bg-transparent"
                onClick={() => setIsMenuOpen(false)}
              />

              <div
                ref={menuContentRef}
                className="fixed z-[141] w-56 rounded-[18px] border border-slate-200 bg-white p-2 shadow-xl"
                style={{
                  top: menuPosition.top,
                  left: menuPosition.left
                }}
                onClick={(event) => event.stopPropagation()}
              >
                {deleteError ? (
                  <p className="px-3 pb-2 pt-1 text-xs text-rose-600">{deleteError}</p>
                ) : null}
                {leaveError ? (
                  <p className="px-3 pb-2 pt-1 text-xs text-rose-600">{leaveError}</p>
                ) : null}

                <button
                  type="button"
                  disabled={isDeleting}
                  className="flex w-full items-center rounded-[16px] px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={handleDeleteHistory}
                >
                  {isDeleting ? dictionary.deleting : dictionary.deleteChatHistory}
                </button>

                <button
                  type="button"
                  disabled={isLeaving}
                  className="mt-1 flex w-full items-center rounded-[16px] px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={handleLeaveChatRoom}
                >
                  {isLeaving ? dictionary.leaving : dictionary.leaveChatRoom}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      <FriendProfileDetail
        friend={selectedFriend}
        onClose={() => setSelectedFriend(null)}
        showCountryLocalTime
        bottomContent={
          selectedFriend ? <ProfileReviewComposer targetUserId={selectedFriend.profile.id} /> : null
        }
      />
    </header>
  );
});
