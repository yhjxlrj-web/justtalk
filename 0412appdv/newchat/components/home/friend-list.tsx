"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FriendProfileDetail } from "@/components/home/friend-profile-detail";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { initialOpenDirectChatState } from "@/lib/chats/action-state";
import { openDirectChatAction } from "@/lib/chats/actions";
import {
  initialManageFriendshipFormState,
  initialRespondToFriendRequestFormState
} from "@/lib/friends/action-state";
import {
  manageFriendshipAction,
  respondToFriendRequestAction
} from "@/lib/friends/actions";
import { getLocaleLabel } from "@/lib/i18n/get-dictionary";
import { getUiCopy } from "@/lib/i18n/ui-copy";
import { cn } from "@/lib/utils";
import type { FriendListItem, FriendProfileSummary } from "@/types/friends";

const SWIPE_ACTION_WIDTH = 98;
const SWIPE_OPEN_THRESHOLD = 44;

type FriendListProps = {
  incomingRequests: FriendListItem[];
  sentRequests: FriendListItem[];
  acceptedFriends: FriendListItem[];
  blockedUsers: FriendListItem[];
  isLoading?: boolean;
  showIncomingRequests?: boolean;
  showSentRequests?: boolean;
  showAcceptedFriends?: boolean;
  showBlockedUsers?: boolean;
  onFriendshipDecision?: (params: {
    decision: "accepted" | "rejected";
    friendshipId: string;
  }) => void;
  onFriendMutation?: (params: {
    action: "block" | "unblock";
    friendshipId: string;
    otherUserId: string;
    friend?: FriendListItem;
  }) => void;
};

type SectionProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  hasItems: boolean;
  children: React.ReactNode;
};

type FriendRowProps = {
  friend: FriendListItem;
  actions?: React.ReactNode;
  compactActions?: boolean;
  now: number;
  subtitleOverride?: string;
  showLastActive?: boolean;
};

type RequestActionControlsProps = {
  friendshipId: string;
};

function buildBlockedFriendListItem(params: {
  friend: FriendListItem;
  friendshipId: string;
  otherUserId: string;
}) {
  return {
    ...params.friend,
    relationship: {
      ...params.friend.relationship,
      id: params.friendshipId,
      requesterId: params.friend.relationship.requesterId,
      addresseeId: params.otherUserId,
      status: "blocked" as const
    },
    direction: "outgoing" as const
  } satisfies FriendListItem;
}

export function formatLastActiveLabel(
  lastActiveAt: string | undefined,
  now: number,
  copy: ReturnType<typeof getUiCopy>
) {
  if (!lastActiveAt) {
    return copy.friendList.recentSeenUnknown;
  }

  const parsedTimestamp = new Date(lastActiveAt).getTime();

  if (Number.isNaN(parsedTimestamp)) {
    return copy.friendList.recentSeenUnknown;
  }

  const elapsedMinutes = Math.floor(Math.max(0, now - parsedTimestamp) / 60000);

  if (elapsedMinutes <= 0) {
    return copy.friendList.justNow;
  }

  if (elapsedMinutes < 60) {
    return copy.friendList.minutesAgo.replace("{count}", String(elapsedMinutes));
  }

  return copy.friendList.hoursAgo.replace("{count}", String(Math.floor(elapsedMinutes / 60)));
}

function FriendSection({
  title,
  description,
  emptyTitle,
  emptyDescription,
  hasItems,
  children
}: SectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[13px] font-semibold text-ink sm:text-sm">{title}</p>
        {description ? (
          <p className="mt-1 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
            {description}
          </p>
        ) : null}
      </div>

      {hasItems ? (
        <div className="space-y-2.5">{children}</div>
      ) : (
        <div className="friend-list-surface rounded-[16px] px-4 py-5 text-center shadow-soft">
          <p className="text-[15px] font-semibold text-ink sm:text-base">{emptyTitle}</p>
          <p className="mt-1.5 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
            {emptyDescription}
          </p>
        </div>
      )}
    </div>
  );
}

export function ProfileListRow({
  actions,
  compactActions = false,
  meta,
  profile,
  subtitle
}: {
  profile: FriendProfileSummary;
  subtitle: string;
  actions?: React.ReactNode;
  compactActions?: boolean;
  meta?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "friend-list-surface rounded-[16px] shadow-soft",
        compactActions ? "px-4 py-2.5" : "px-4 py-3"
      )}
    >
      <div
        className={cn(
          compactActions
            ? "grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-3"
            : "flex items-center gap-3"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-brand-50 font-semibold text-brand-700 shadow-soft",
            compactActions
              ? "h-11 w-11 rounded-[15px] text-[14px]"
              : "h-12 w-12 rounded-[16px] text-[15px]"
          )}
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={`${profile.displayName} avatar`}
              className="h-full w-full object-cover"
            />
          ) : (
            (profile.displayName.charAt(0) || "F").toUpperCase()
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink sm:text-base">
            {profile.displayName}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-slate-500",
              compactActions
                ? "text-[11px] leading-4 sm:text-[13px]"
                : "text-[12px] leading-4.5 sm:text-sm"
            )}
          >
            {subtitle}
          </p>
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>

        {actions ? (
          <div
            className={cn(
              "shrink-0",
              compactActions ? "flex items-center justify-center" : "ml-auto flex items-center"
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FriendRow({
  friend,
  actions,
  compactActions = false,
  now,
  subtitleOverride,
  showLastActive = false
}: FriendRowProps) {
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const languageLabel = friend.profile.preferredLanguage
    ? getLocaleLabel(friend.profile.preferredLanguage)
    : "";
  const locationLabel = [friend.profile.country, languageLabel].filter(Boolean).join(" / ");
  const shouldShowLastActive = showLastActive && friend.profile.showLastSeen !== false;
  const subtitle =
    subtitleOverride ??
    (shouldShowLastActive
      ? formatLastActiveLabel(friend.profile.lastActiveAt, now, copy)
      : friend.profile.statusMessage || locationLabel || copy.friendList.recentSeenUnknown);

  return (
    <ProfileListRow
      profile={friend.profile}
      subtitle={subtitle}
      actions={actions}
      compactActions={compactActions}
    />
  );
}

function AcceptedFriendActions({ friend }: { friend: FriendListItem }) {
  const dictionary = useDictionary();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    openDirectChatAction,
    initialOpenDirectChatState
  );

  useEffect(() => {
    if (!state?.chatId) {
      return;
    }

    router.push(`/chat/${state.chatId}`);
  }, [router, state?.chatId]);

  return (
    <div
      className="flex"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <form action={formAction}>
        <input type="hidden" name="friendId" value={friend.profile.id} />
        <PrimaryButton
          type="submit"
          className="h-10 min-w-[86px] gap-1.5 rounded-[14px] px-3 text-[12px] font-semibold"
          disabled={isPending}
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0 stroke-[2.25]" />
          <span>{isPending ? dictionary.opening : dictionary.chat}</span>
        </PrimaryButton>
      </form>
    </div>
  );
}

function IncomingRequestActions({
  friendshipId,
  onDecision
}: RequestActionControlsProps & {
  onDecision?: (params: { decision: "accepted" | "rejected"; friendshipId: string }) => void;
}) {
  const dictionary = useDictionary();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    respondToFriendRequestAction,
    initialRespondToFriendRequestFormState
  );

  useEffect(() => {
    if (!state?.successMessage || !state.decision) {
      return;
    }

    onDecision?.({ decision: state.decision, friendshipId });
    router.refresh();
  }, [friendshipId, onDecision, router, state?.decision, state?.successMessage]);

  return (
    <form action={formAction} className="w-full space-y-3">
      <input type="hidden" name="friendshipId" value={friendshipId} />

      {state?.error ? (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-soft">
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <PrimaryButton
          type="submit"
          name="decision"
          value="accepted"
          className="sm:w-auto"
          disabled={isPending}
        >
          {isPending ? dictionary.connecting : dictionary.accept}
        </PrimaryButton>
        <SecondaryButton
          type="submit"
          name="decision"
          value="rejected"
          className="sm:w-auto"
          disabled={isPending}
        >
          {dictionary.reject}
        </SecondaryButton>
      </div>
    </form>
  );
}

function ManageAcceptedFriendshipActions({
  friend,
  onClose,
  onMutation
}: {
  friend: FriendListItem;
  onClose: () => void;
  onMutation?: (params: {
    action: "block" | "unblock";
    friendshipId: string;
    otherUserId: string;
    friend?: FriendListItem;
  }) => void;
}) {
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const [state, formAction, isPending] = useActionState(
    manageFriendshipAction,
    initialManageFriendshipFormState
  );

  useEffect(() => {
    if (!state?.successMessage || !state.action || !state.friendshipId || !state.otherUserId) {
      return;
    }

    console.log("manage accepted friend action success", {
      action: state.action,
      friendshipId: state.friendshipId,
      otherUserId: state.otherUserId
    });

    onMutation?.({
      action: state.action,
      friendshipId: state.friendshipId,
      otherUserId: state.otherUserId,
      friend
    });
    onClose();
  }, [friend, onClose, onMutation, state]);

  return (
    <div
      className="absolute inset-y-0 right-0 flex items-stretch gap-2 pl-3"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <form action={formAction} className="flex">
        <input type="hidden" name="friendshipId" value={friend.relationship.id} />
        <input type="hidden" name="otherUserId" value={friend.profile.id} />
        <button
          type="submit"
          name="action"
          value="block"
          disabled={isPending}
          className="flex min-w-[86px] items-center justify-center rounded-[14px] bg-rose-500 px-3 text-[12px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          onClick={(event) => {
            if (!window.confirm(copy.friendList.blockConfirm)) {
              event.preventDefault();
            }
          }}
        >
          {copy.friendList.blockAction}
        </button>
      </form>
    </div>
  );
}

function BlockedFriendActions({
  friend,
  onMutation
}: {
  friend: FriendListItem;
  onMutation?: (params: {
    action: "block" | "unblock";
    friendshipId: string;
    otherUserId: string;
    friend?: FriendListItem;
  }) => void;
}) {
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const [state, formAction, isPending] = useActionState(
    manageFriendshipAction,
    initialManageFriendshipFormState
  );

  useEffect(() => {
    if (!state?.successMessage || state.action !== "unblock" || !state.friendshipId || !state.otherUserId) {
      return;
    }

    onMutation?.({
      action: state.action,
      friendshipId: state.friendshipId,
      otherUserId: state.otherUserId,
      friend: {
        ...friend,
        relationship: {
          ...friend.relationship,
          status: "accepted"
        }
      }
    });
  }, [friend, onMutation, state]);

  return (
    <form
      action={formAction}
      className="flex"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <input type="hidden" name="friendshipId" value={friend.relationship.id} />
      <input type="hidden" name="otherUserId" value={friend.profile.id} />
      <button
        type="submit"
        name="action"
        value="unblock"
        disabled={isPending}
        className="flex h-9 min-w-[86px] items-center justify-center rounded-[14px] border border-slate-200 bg-slate-50 px-3 text-[12px] font-semibold text-slate-700 transition active:scale-[0.98] disabled:opacity-60"
        onClick={() => {
          console.log("blocked friend unblock button click", {
            action: "unblock",
            friendshipId: friend.relationship.id,
            otherUserId: friend.profile.id
          });
        }}
      >
        {copy.friendList.unblockAction}
      </button>
    </form>
  );
}

function SwipeableAcceptedFriendRow({
  friend,
  isOpen,
  now,
  onCloseActions,
  onMutation,
  onOpenActions,
  onOpenProfile
}: {
  friend: FriendListItem;
  isOpen: boolean;
  now: number;
  onCloseActions: () => void;
  onMutation?: (params: {
    action: "block" | "unblock";
    friendshipId: string;
    otherUserId: string;
    friend?: FriendListItem;
  }) => void;
  onOpenActions: (friendshipId: string) => void;
  onOpenProfile: (friend: FriendListItem) => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const movedRef = useRef(false);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (pointerIdRef.current !== null) {
      return;
    }

    setOffsetX(isOpen ? -SWIPE_ACTION_WIDTH : 0);
  }, [isOpen]);

  const finishSwipe = (shouldOpen: boolean) => {
    pointerIdRef.current = null;
    setOffsetX(shouldOpen ? -SWIPE_ACTION_WIDTH : 0);

    if (shouldOpen) {
      onOpenActions(friend.relationship.id);
      return;
    }

    onCloseActions();
  };

  return (
    <div className="relative overflow-hidden rounded-[16px]">
      <ManageAcceptedFriendshipActions
        friend={friend}
        onClose={onCloseActions}
        onMutation={onMutation}
      />

      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        className="relative rounded-[16px] outline-none transition-transform duration-200 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-brand-300"
        style={{
          transform: `translateX(${offsetX}px)`,
          touchAction: "pan-y"
        }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button, form, a, input")) {
            return;
          }

          pointerIdRef.current = event.pointerId;
          startXRef.current = event.clientX;
          startOffsetRef.current = isOpen ? -SWIPE_ACTION_WIDTH : 0;
          movedRef.current = false;
          rowRef.current?.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (pointerIdRef.current !== event.pointerId) {
            return;
          }

          const deltaX = event.clientX - startXRef.current;

          if (Math.abs(deltaX) > 8) {
            movedRef.current = true;
          }

          const nextOffset = Math.max(
            -SWIPE_ACTION_WIDTH,
            Math.min(0, startOffsetRef.current + deltaX)
          );

          setOffsetX(nextOffset);

          if (nextOffset < 0) {
            onOpenActions(friend.relationship.id);
          }
        }}
        onPointerUp={(event) => {
          if (pointerIdRef.current !== event.pointerId) {
            return;
          }

          const shouldOpen = Math.abs(offsetX) > SWIPE_OPEN_THRESHOLD;
          finishSwipe(shouldOpen);
        }}
        onPointerCancel={(event) => {
          if (pointerIdRef.current !== event.pointerId) {
            return;
          }

          finishSwipe(isOpen);
        }}
        onClick={() => {
          if (movedRef.current) {
            movedRef.current = false;
            return;
          }

          if (isOpen) {
            onCloseActions();
            return;
          }

          onOpenProfile(friend);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (isOpen) {
              onCloseActions();
              return;
            }

            onOpenProfile(friend);
          }

          if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            onCloseActions();
          }
        }}
      >
        <FriendRow
          friend={friend}
          actions={<AcceptedFriendActions friend={friend} />}
          compactActions
          now={now}
          showLastActive
        />
      </div>
    </div>
  );
}

export function FriendList({
  incomingRequests,
  sentRequests,
  acceptedFriends,
  blockedUsers,
  isLoading = false,
  showIncomingRequests = true,
  showSentRequests = true,
  showAcceptedFriends = true,
  showBlockedUsers = true,
  onFriendshipDecision,
  onFriendMutation
}: FriendListProps) {
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const [now, setNow] = useState(() => Date.now());
  const [incomingRequestItems, setIncomingRequestItems] = useState(incomingRequests);
  const [sentRequestItems, setSentRequestItems] = useState(sentRequests);
  const [acceptedFriendItems, setAcceptedFriendItems] = useState(acceptedFriends);
  const [blockedUserItems, setBlockedUserItems] = useState(blockedUsers);
  const [selectedFriend, setSelectedFriend] = useState<FriendListItem | null>(null);
  const [openActionRowId, setOpenActionRowId] = useState<string | null>(null);

  useEffect(() => {
    setIncomingRequestItems(incomingRequests);
  }, [incomingRequests]);

  useEffect(() => {
    setSentRequestItems(sentRequests);
  }, [sentRequests]);

  useEffect(() => {
    setAcceptedFriendItems(acceptedFriends);
  }, [acceptedFriends]);

  useEffect(() => {
    setBlockedUserItems(blockedUsers);
  }, [blockedUsers]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  if (isLoading) {
    return <FriendListLoadingState />;
  }

  return (
    <>
      <div
        className="space-y-3.5 sm:space-y-4"
        onClick={() => {
          if (openActionRowId) {
            setOpenActionRowId(null);
          }
        }}
      >
        {showIncomingRequests ? (
          <FriendSection
            title={dictionary.pendingRequests}
            description={dictionary.incomingRequestsDescription}
            emptyTitle={dictionary.noIncomingRequests}
            emptyDescription={dictionary.noIncomingRequestsDescription}
            hasItems={incomingRequestItems.length > 0}
          >
            {incomingRequestItems.map((friend) => (
              <FriendRow
                key={friend.relationship.id}
                friend={friend}
                actions={
                  <IncomingRequestActions
                    friendshipId={friend.relationship.id}
                    onDecision={onFriendshipDecision}
                  />
                }
                now={now}
                showLastActive={false}
              />
            ))}
          </FriendSection>
        ) : null}

        {showSentRequests ? (
          <FriendSection
            title={dictionary.sentRequests}
            description={dictionary.sentRequestsDescription}
            emptyTitle={dictionary.noSentRequests}
            emptyDescription={dictionary.noSentRequestsDescription}
            hasItems={sentRequestItems.length > 0}
          >
            {sentRequestItems.map((friend) => (
              <FriendRow
                key={friend.relationship.id}
                friend={friend}
                now={now}
                showLastActive={false}
              />
            ))}
          </FriendSection>
        ) : null}

        {showAcceptedFriends ? (
          <FriendSection
            title={dictionary.friendsList}
            description={dictionary.acceptedFriendsDescription}
            emptyTitle={dictionary.noAcceptedFriends}
            emptyDescription={dictionary.noAcceptedFriendsDescription}
            hasItems={acceptedFriendItems.length > 0}
          >
            {acceptedFriendItems.map((friend) => (
              <SwipeableAcceptedFriendRow
                key={friend.relationship.id}
                friend={friend}
                isOpen={openActionRowId === friend.relationship.id}
                now={now}
                onCloseActions={() => setOpenActionRowId(null)}
                onMutation={(params) => {
                  console.log("friendList local mutation patch", {
                    action: params.action,
                    friendshipId: params.friendshipId,
                    otherUserId: params.otherUserId,
                    acceptedFriendsLengthBefore: acceptedFriendItems.length,
                    incomingRequestsLengthBefore: incomingRequestItems.length,
                    sentRequestsLengthBefore: sentRequestItems.length
                  });

                  setOpenActionRowId(null);
                  setAcceptedFriendItems((current) => {
                    const next = current.filter(
                      (item) =>
                        item.relationship.id !== params.friendshipId &&
                        item.profile.id !== params.otherUserId
                    );

                    console.log("friendList block acceptedFriends patched", {
                      blockedUserId: params.otherUserId,
                      acceptedFriendsLengthBefore: current.length,
                      acceptedFriendsLengthAfter: next.length
                    });

                    return next;
                  });
                  setBlockedUserItems((current) =>
                    {
                      const filtered = current.filter(
                        (item) =>
                          item.relationship.id !== params.friendshipId &&
                          item.profile.id !== params.otherUserId
                      );

                      if (params.action !== "block" || !params.friend) {
                        return filtered;
                      }

                      const alreadyExists = filtered.some(
                        (item) =>
                          item.relationship.id === params.friendshipId ||
                          item.profile.id === params.otherUserId
                      );

                      if (alreadyExists) {
                        console.log("friendList block blockedUsers patched", {
                          blockedUserId: params.otherUserId,
                          blockedUsersLengthAfter: filtered.length,
                          duplicateSkipped: true
                        });
                        return filtered;
                      }

                      const next = [
                        buildBlockedFriendListItem({
                          friend: params.friend,
                          friendshipId: params.friendshipId,
                          otherUserId: params.otherUserId
                        }),
                        ...filtered
                      ];

                      console.log("friendList block blockedUsers patched", {
                        blockedUserId: params.otherUserId,
                        blockedUsersLengthBefore: current.length,
                        blockedUsersLengthAfter: next.length
                      });

                      return next;
                    }
                  );
                  setIncomingRequestItems((current) =>
                    current.filter(
                      (item) =>
                        item.relationship.id !== params.friendshipId &&
                        item.profile.id !== params.otherUserId
                    )
                  );
                  setSentRequestItems((current) =>
                    current.filter(
                      (item) =>
                        item.relationship.id !== params.friendshipId &&
                        item.profile.id !== params.otherUserId
                    )
                  );
                  onFriendMutation?.(params);
                }}
                onOpenActions={setOpenActionRowId}
                onOpenProfile={setSelectedFriend}
              />
            ))}
          </FriendSection>
        ) : null}

        {showBlockedUsers ? (
          <FriendSection
            title={copy.friendList.blockedTitle}
            description={copy.friendList.blockedDescription}
            emptyTitle={copy.friendList.noBlockedUsers}
            emptyDescription={copy.friendList.noBlockedUsersDescription}
            hasItems={blockedUserItems.length > 0}
          >
            {blockedUserItems.map((friend) => (
              <div
                key={friend.relationship.id}
                role="button"
                tabIndex={0}
                className="outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                onClick={() => setSelectedFriend(friend)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedFriend(friend);
                  }
                }}
              >
                <FriendRow
                  friend={friend}
                  now={now}
                  showLastActive={false}
                  actions={
                    <BlockedFriendActions
                      friend={friend}
                      onMutation={(params) => {
                        console.log("friendList unblock patch", {
                          friendshipId: params.friendshipId,
                          otherUserId: params.otherUserId,
                          blockedUsersLengthBefore: blockedUserItems.length,
                          acceptedFriendsLengthBefore: acceptedFriendItems.length
                        });

                        setBlockedUserItems((current) => {
                          const next = current.filter(
                            (item) =>
                              item.relationship.id !== params.friendshipId &&
                              item.profile.id !== params.otherUserId
                          );

                          console.log("friendList unblock blockedUsers patched", {
                            friendshipId: params.friendshipId,
                            otherUserId: params.otherUserId,
                            blockedUsersLengthAfter: next.length
                          });

                          return next;
                        });
                        setAcceptedFriendItems((current) => {
                          if (!params.friend) {
                            return current;
                          }

                          const alreadyExists = current.some(
                            (item) =>
                              item.relationship.id === params.friendshipId ||
                              item.profile.id === params.otherUserId
                          );

                          if (alreadyExists) {
                            return current;
                          }

                          const next = [params.friend, ...current];

                          console.log("friendList unblock acceptedFriends patched", {
                            friendshipId: params.friendshipId,
                            otherUserId: params.otherUserId,
                            acceptedFriendsLengthAfter: next.length
                          });

                          return next;
                        });
                        onFriendMutation?.(params);
                      }}
                    />
                  }
                />
              </div>
            ))}
          </FriendSection>
        ) : null}
      </div>

      <FriendProfileDetail friend={selectedFriend} onClose={() => setSelectedFriend(null)} />
    </>
  );
}

export function FriendListLoadingState() {
  return (
    <div className="space-y-3.5 sm:space-y-4">
      {[0, 1, 2].map((section) => (
        <div key={section} className="space-y-3">
          <div className="h-3.5 w-28 animate-pulse rounded-full bg-brand-100" />
          <div className="h-3 w-44 animate-pulse rounded-full bg-slate-200" />
          <div className="space-y-2.5">
            {[0, 1].map((item) => (
              <div
            key={`${section}-${item}`}
                className="friend-list-surface flex items-center gap-3 rounded-[16px] px-3.5 py-3 shadow-soft"
              >
                <div className="h-10 w-10 animate-pulse rounded-[14px] bg-brand-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-28 animate-pulse rounded-full bg-brand-100" />
                  <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
