"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Heart, MessageCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { FriendProfileDetail } from "@/components/home/friend-profile-detail";
import { ProfileReviewList } from "@/components/home/profile-review-sections";
import {
  getCachedCommunityNotifications,
  getCachedCommunityNotificationsReadAt,
  setCachedCommunityNotificationsReadAt,
  setCachedCommunityNotifications
} from "@/components/home/community-notification-cache";
import { FriendListLoadingState } from "@/components/home/friend-list";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { initialCommunityHeartActionState } from "@/lib/community/action-state";
import { sendCommunityHeartAction } from "@/lib/community/actions";
import {
  getCommunityNotifications,
  getSentCommunityHeartReceiverIds
} from "@/lib/community/notifications";
import { initialCreateFriendRequestFormState } from "@/lib/friends/action-state";
import { createFriendRequestByUserIdAction } from "@/lib/friends/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getUiCopy } from "@/lib/i18n/ui-copy";
import type { CommunityNotificationItem, CommunityProfileItem } from "@/types/community";
import type { FriendListItem } from "@/types/friends";

type NotificationMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const COUNTRY_FLAG_EMOJIS: Record<string, string> = {
  "south korea": "🇰🇷",
  korea: "🇰🇷",
  japan: "🇯🇵",
  germany: "🇩🇪",
  spain: "🇪🇸",
  france: "🇫🇷",
  italy: "🇮🇹",
  "united kingdom": "🇬🇧",
  uk: "🇬🇧",
  "united states": "🇺🇸",
  usa: "🇺🇸",
  canada: "🇨🇦",
  australia: "🇦🇺",
  india: "🇮🇳",
  china: "🇨🇳",
  argentina: "🇦🇷",
  mexico: "🇲🇽",
  brazil: "🇧🇷",
  singapore: "🇸🇬"
};

type CommunityRelationshipState = "none" | "sent" | "incoming" | "accepted";

function buildCommunityFriendListItem(profile: CommunityProfileItem, friendshipId?: string): FriendListItem {
  return {
    relationship: {
      id: friendshipId ?? `community-${profile.id}`,
      requesterId: profile.id,
      addresseeId: profile.id,
      status: "accepted"
    },
    profile: {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      statusMessage: profile.statusMessage,
      country: profile.country,
      preferredLanguage: profile.preferredLanguage,
      avatarUrl: profile.avatarUrl,
      lastActiveAt: profile.showLastSeen === false ? undefined : profile.lastActiveAt,
      showLastSeen: profile.showLastSeen
    },
    direction: "incoming"
  };
}

function formatNotificationTimestamp(locale: string, createdAt: number) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(createdAt);
}

function getLatestNotificationCreatedAt(items: CommunityNotificationItem[]) {
  return items.reduce((maxValue, item) => Math.max(maxValue, item.createdAt), 0);
}

function getCountryLabelWithFlag(country?: string) {
  if (!country) {
    return "";
  }

  const trimmedCountry = country.trim();
  const flagEmoji = COUNTRY_FLAG_EMOJIS[trimmedCountry.toLowerCase()];

  return flagEmoji ? `${trimmedCountry} ${flagEmoji}` : trimmedCountry;
}

function CommunityHeartButton({
  alreadySent,
  onHeartSent,
  receiverUserId
}: {
  alreadySent: boolean;
  onHeartSent: (receiverUserId: string) => void;
  receiverUserId: string;
}) {
  const locale = useCurrentLocale();
  const dictionary = useDictionary();
  const copy = getUiCopy(locale);
  const duplicateNoticeTimeoutRef = useRef<number | null>(null);
  const handledSuccessKeyRef = useRef<string | null>(null);
  const [showAlreadySentNotice, setShowAlreadySentNotice] = useState(false);
  const [optimisticSent, setOptimisticSent] = useState(alreadySent);
  const [isLocallyPending, setIsLocallyPending] = useState(false);
  const [state, formAction, isPending] = useActionState(
    sendCommunityHeartAction,
    initialCommunityHeartActionState
  );
  const hasSentHeart = alreadySent || optimisticSent;

  useEffect(() => {
    if (alreadySent) {
      setOptimisticSent(true);
      setIsLocallyPending(false);
    }
  }, [alreadySent]);

  useEffect(() => {
    console.log("community heart alreadySent state", {
      receiverUserId,
      alreadySent
    });
  }, [alreadySent, receiverUserId]);

  useEffect(() => {
    return () => {
      if (duplicateNoticeTimeoutRef.current) {
        window.clearTimeout(duplicateNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!state?.success || !state.receiverUserId) {
      return;
    }

    const successKey = `${state.receiverUserId}:${state.notificationId ?? "existing"}`;

    if (handledSuccessKeyRef.current === successKey) {
      return;
    }

    handledSuccessKeyRef.current = successKey;
    setIsLocallyPending(false);
    setOptimisticSent(true);
    onHeartSent(state.receiverUserId);

    console.log("community heart success", {
      receiverUserId: state.receiverUserId,
      notificationId: state.notificationId ?? null,
      alreadySent: state.alreadySent ?? false
    });
  }, [onHeartSent, state?.alreadySent, state?.notificationId, state?.receiverUserId, state?.success]);

  useEffect(() => {
    if (state?.error) {
      setIsLocallyPending(false);
      console.error("community heart action failed", {
        receiverUserId,
        error: state.error
      });
    }
  }, [receiverUserId, state?.error]);

  if (hasSentHeart) {
    return (
      <SecondaryButton
        type="button"
        className="h-10 w-full gap-1.5 rounded-[14px] px-3 text-[12px] font-semibold opacity-70"
        onClick={() => {
          console.log("community heart duplicate click", {
            receiverUserId,
            alreadySent: hasSentHeart
          });
          setShowAlreadySentNotice(true);

          if (duplicateNoticeTimeoutRef.current) {
            window.clearTimeout(duplicateNoticeTimeoutRef.current);
          }

          duplicateNoticeTimeoutRef.current = window.setTimeout(() => {
            setShowAlreadySentNotice(false);
          }, 1800);
        }}
      >
        <Heart className="h-3.5 w-3.5 shrink-0 fill-current" />
        <span>
          {showAlreadySentNotice
            ? copy.friendList.communityHeartAlreadySent
            : copy.friendList.communityHeartSent}
        </span>
      </SecondaryButton>
    );
  }

  return (
    <form
      action={formAction}
      className="flex-1"
      onSubmit={() => {
        console.log("community heart button submit", {
          receiverUserId,
          alreadySent: hasSentHeart
        });
        setIsLocallyPending(true);
      }}
    >
      <input type="hidden" name="receiverUserId" value={receiverUserId} />
      <SecondaryButton
        type="submit"
        className="h-10 w-full gap-1.5 rounded-[14px] px-3 text-[12px] font-semibold"
        disabled={isPending || isLocallyPending || hasSentHeart}
        aria-label={state?.error ?? copy.friendList.communityHeartAction}
      >
        <Heart className="h-3.5 w-3.5 shrink-0" />
        <span>{isPending || isLocallyPending ? dictionary.sending : copy.friendList.communityHeartAction}</span>
      </SecondaryButton>
    </form>
  );
}

function CommunityRequestButton({
  buttonClassName,
  disablePressEffect,
  formClassName,
  loadingLabel,
  profile,
  relationshipState,
  onRequestSent
}: {
  buttonClassName?: string;
  disablePressEffect?: boolean;
  formClassName?: string;
  loadingLabel?: string;
  profile: CommunityProfileItem;
  relationshipState: CommunityRelationshipState;
  onRequestSent: (params: {
    friendshipId: string;
    otherUserId: string;
    profile: CommunityProfileItem;
  }) => void;
}) {
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const handledRequestKeyRef = useRef<string | null>(null);
  const [optimisticRequested, setOptimisticRequested] = useState(false);
  const [isLocallyPending, setIsLocallyPending] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createFriendRequestByUserIdAction,
    initialCreateFriendRequestFormState
  );
  const wrapperClassName = formClassName ?? "flex-1";
  const resolvedButtonClassName =
    buttonClassName ?? "h-10 w-full gap-1.5 rounded-[14px] px-3 text-[12px] font-semibold";
  const isButtonPending = isPending || isLocallyPending;
  const effectiveRelationshipState: CommunityRelationshipState =
    relationshipState === "none" && optimisticRequested ? "sent" : relationshipState;

  useEffect(() => {
    if (relationshipState !== "none") {
      setOptimisticRequested(false);
      setIsLocallyPending(false);
    }
  }, [relationshipState]);

  useEffect(() => {
    if (!state?.successMessage || !state.friendshipId || !state.otherUserId) {
      return;
    }

    const handledKey = `${state.friendshipId}:${state.otherUserId}`;

    if (handledRequestKeyRef.current === handledKey) {
      return;
    }

    handledRequestKeyRef.current = handledKey;
    setIsLocallyPending(false);
    setOptimisticRequested(true);

    onRequestSent({
      friendshipId: state.friendshipId,
      otherUserId: state.otherUserId,
      profile
    });
  }, [onRequestSent, profile, state?.friendshipId, state?.otherUserId, state?.successMessage]);

  useEffect(() => {
    if (!state?.errors.form && !state?.errors.email) {
      return;
    }

    setIsLocallyPending(false);
    setOptimisticRequested(false);
  }, [state?.errors.email, state?.errors.form]);

  if (effectiveRelationshipState === "sent") {
    return (
      <div className={wrapperClassName}>
        <SecondaryButton
          type="button"
          className={resolvedButtonClassName}
          disablePressEffect={disablePressEffect}
          disabled
        >
          <span className="truncate">{copy.friendList.communityRequestSent}</span>
        </SecondaryButton>
      </div>
    );
  }

  if (effectiveRelationshipState === "incoming") {
    return (
      <div className={wrapperClassName}>
        <SecondaryButton
          type="button"
          className={resolvedButtonClassName}
          disablePressEffect={disablePressEffect}
          disabled
        >
          <span className="truncate">{copy.friendList.communityRequestReceived}</span>
        </SecondaryButton>
      </div>
    );
  }

  if (effectiveRelationshipState === "accepted") {
    return (
      <div className={wrapperClassName}>
        <SecondaryButton
          type="button"
          className={resolvedButtonClassName}
          disablePressEffect={disablePressEffect}
          disabled
        >
          <span className="truncate">{copy.friendList.communityRequestAccepted}</span>
        </SecondaryButton>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={wrapperClassName}
      onSubmit={() => {
        console.log("community request optimistic submit", {
          otherUserId: profile.id,
          relationshipState: effectiveRelationshipState
        });
        setIsLocallyPending(true);
      }}
    >
      <input type="hidden" name="otherUserId" value={profile.id} />
      <PrimaryButton
        type="submit"
        className={resolvedButtonClassName}
        disablePressEffect={disablePressEffect}
        disabled={isButtonPending}
        aria-label={state?.errors.form ?? copy.friendList.communityRequestAction}
      >
        <MessageCircle className="h-3.5 w-3.5 shrink-0 stroke-[2.25]" />
        <span className="truncate">
          {isButtonPending ? loadingLabel ?? dictionary.sending : copy.friendList.communityRequestAction}
        </span>
      </PrimaryButton>
    </form>
  );
}

function CommunityNotificationRequestButton({
  notification,
  relationshipState,
  onRequestSent
}: {
  notification: CommunityNotificationItem;
  relationshipState: CommunityRelationshipState;
  onRequestSent: (params: {
    friendshipId: string;
    otherUserId: string;
    profile: CommunityProfileItem;
  }) => void;
}) {
  const dictionary = useDictionary();

  return (
    <CommunityRequestButton
      profile={notification.senderProfile}
      relationshipState={relationshipState}
      onRequestSent={onRequestSent}
      formClassName="w-full"
      disablePressEffect
      loadingLabel={dictionary.sending}
      buttonClassName="h-7 w-full gap-1.5 rounded-[12px] px-3 text-[11px] font-semibold"
    />
  );
}

function CommunityProfileCard({
  alreadyHeartSent,
  onOpenProfile,
  onHeartSent,
  onRequestSent,
  profile,
  relationshipState
}: {
  alreadyHeartSent: boolean;
  onHeartSent: (receiverUserId: string) => void;
  profile: CommunityProfileItem;
  relationshipState: CommunityRelationshipState;
  onOpenProfile: (profile: CommunityProfileItem) => void;
  onRequestSent: (params: {
    friendshipId: string;
    otherUserId: string;
    profile: CommunityProfileItem;
  }) => void;
}) {
  const countryLabel = getCountryLabelWithFlag(profile.country);
  const infoLabels = [countryLabel, profile.preferredLanguage].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      className="friend-list-surface rounded-[18px] p-4 shadow-soft outline-none transition focus-visible:ring-2 focus-visible:ring-brand-300"
      onClick={() => onOpenProfile(profile)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenProfile(profile);
        }
      }}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-[112px] w-[112px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-brand-50 text-[32px] font-semibold text-brand-700 shadow-soft">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={`${profile.displayName} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              (profile.displayName.charAt(0) || "J").toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[16px] font-semibold text-ink sm:text-[17px]">
              {profile.displayName}
            </p>
            {profile.statusMessage ? (
              <p className="mt-1 text-[12px] leading-5 text-slate-600 sm:text-[13px] sm:leading-6">
                {profile.statusMessage}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {infoLabels.map((value) => (
                <span
                  key={`${profile.id}-${value}`}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium leading-none text-slate-600"
                >
                  {value}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-2"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CommunityRequestButton
            profile={profile}
            relationshipState={relationshipState}
            onRequestSent={onRequestSent}
          />
          <div className="flex-1">
            <CommunityHeartButton
              alreadySent={alreadyHeartSent}
              onHeartSent={onHeartSent}
              receiverUserId={profile.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommunityList({
  acceptedFriendUserIds,
  blockedUserIds,
  incomingRequestUserIds,
  isLoading,
  onCommunityRequestSent,
  profiles,
  sentRequestUserIds,
  userId
}: {
  acceptedFriendUserIds: string[];
  blockedUserIds: string[];
  incomingRequestUserIds: string[];
  profiles: CommunityProfileItem[] | null;
  isLoading: boolean;
  onCommunityRequestSent: (params: {
    friendshipId: string;
    otherUserId: string;
    profile: CommunityProfileItem;
  }) => void;
  sentRequestUserIds: string[];
  userId: string;
}) {
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [selectedFriend, setSelectedFriend] = useState<FriendListItem | null>(null);
  const [notifications, setNotifications] = useState<CommunityNotificationItem[]>(() =>
    getCachedCommunityNotifications(userId)
  );
  const [notificationsReadAt, setNotificationsReadAt] = useState(() =>
    getCachedCommunityNotificationsReadAt(userId)
  );
  const [sentHeartUserIds, setSentHeartUserIds] = useState<string[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationMenuPosition, setNotificationMenuPosition] =
    useState<NotificationMenuPosition | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationFetchPromiseRef = useRef<Promise<CommunityNotificationItem[]> | null>(null);
  const heartStateFetchPromiseRef = useRef<Promise<Set<string>> | null>(null);
  const notificationsReadAtRef = useRef(notificationsReadAt);
  const isNotificationsOpenRef = useRef(isNotificationsOpen);
  const visibleNotificationsRef = useRef<CommunityNotificationItem[]>([]);
  const blockedUserIdSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);
  const acceptedFriendUserIdSet = useMemo(
    () => new Set(acceptedFriendUserIds),
    [acceptedFriendUserIds]
  );
  const sentRequestUserIdSet = useMemo(() => new Set(sentRequestUserIds), [sentRequestUserIds]);
  const incomingRequestUserIdSet = useMemo(
    () => new Set(incomingRequestUserIds),
    [incomingRequestUserIds]
  );
  const sentHeartUserIdSet = useMemo(() => new Set(sentHeartUserIds), [sentHeartUserIds]);
  const visibleNotifications = useMemo(
    () => notifications.filter((item) => !blockedUserIdSet.has(item.senderUserId)),
    [blockedUserIdSet, notifications]
  );

  const commitNotificationsReadAt = useCallback(
    (readAt: number) => {
      const normalizedReadAt =
        Number.isFinite(readAt) && readAt > 0 ? Math.floor(readAt) : 0;

      if (normalizedReadAt <= 0) {
        return;
      }

      setNotificationsReadAt((currentReadAt) => {
        const nextReadAt = Math.max(currentReadAt, normalizedReadAt);

        if (nextReadAt !== currentReadAt) {
          notificationsReadAtRef.current = nextReadAt;
          setCachedCommunityNotificationsReadAt(userId, nextReadAt);
        }

        return nextReadAt;
      });
    },
    [userId]
  );

  useEffect(() => {
    notificationsReadAtRef.current = notificationsReadAt;
  }, [notificationsReadAt]);

  useEffect(() => {
    isNotificationsOpenRef.current = isNotificationsOpen;
  }, [isNotificationsOpen]);

  useEffect(() => {
    visibleNotificationsRef.current = visibleNotifications;
  }, [visibleNotifications]);

  const loadNotifications = useMemo(
    () => async (force = false) => {
      const cachedItems = getCachedCommunityNotifications(userId);

      if (cachedItems.length > 0) {
        setNotifications(cachedItems);
      }

      if (!force && notificationFetchPromiseRef.current) {
        return notificationFetchPromiseRef.current;
      }

      const fetchPromise = getCommunityNotifications(supabase, userId)
        .then((items) => {
          setCachedCommunityNotifications(userId, items);
          setNotifications(items);

          if (isNotificationsOpenRef.current) {
            const latestReadAt = Math.max(Date.now(), getLatestNotificationCreatedAt(items));
            commitNotificationsReadAt(latestReadAt);
          }

          return items;
        })
        .catch((error) => {
          console.error("Failed to load community notifications", {
            userId,
            error
          });
          return cachedItems;
        })
        .finally(() => {
          if (notificationFetchPromiseRef.current === fetchPromise) {
            notificationFetchPromiseRef.current = null;
          }
        });

      notificationFetchPromiseRef.current = fetchPromise;
      return fetchPromise;
    },
    [commitNotificationsReadAt, supabase, userId]
  );

  useEffect(() => {
    void loadNotifications(true);
  }, [loadNotifications]);

  useEffect(() => {
    const receiverUserIds = (profiles ?? []).map((profile) => profile.id);

    if (receiverUserIds.length === 0) {
      setSentHeartUserIds([]);
      return;
    }

    const loadSentHearts = async () => {
      if (heartStateFetchPromiseRef.current) {
        const existingResult = await heartStateFetchPromiseRef.current;
        setSentHeartUserIds((current) =>
          Array.from(new Set([...current, ...Array.from(existingResult)]))
        );
        return;
      }

      const fetchPromise = getSentCommunityHeartReceiverIds(supabase, userId, receiverUserIds)
        .then((result) => {
          console.log("community heart sent-state loaded", {
            senderUserId: userId,
            sentReceiverIds: Array.from(result)
          });
          setSentHeartUserIds((current) =>
            Array.from(new Set([...current, ...Array.from(result)]))
          );
          return result;
        })
        .catch((error) => {
          console.error("Failed to load sent community hearts", {
            userId,
            error
          });
          return new Set<string>();
        })
        .finally(() => {
          if (heartStateFetchPromiseRef.current === fetchPromise) {
            heartStateFetchPromiseRef.current = null;
          }
        });

      heartStateFetchPromiseRef.current = fetchPromise;
      await fetchPromise;
    };

    void loadSentHearts();
  }, [profiles, supabase, userId]);

  useEffect(() => {
    const channel = supabase.channel(`community-notifications:${userId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_notifications",
          filter: `receiver_user_id=eq.${userId}`
        },
        () => {
          void loadNotifications(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "community_notifications",
          filter: `receiver_user_id=eq.${userId}`
        },
        () => {
          void loadNotifications(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, supabase, userId]);

  const updateNotificationPosition = useMemo(
    () => () => {
      const rect = notificationButtonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const safeMargin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(220, viewportWidth - safeMargin * 2);
      const maxHeight = Math.min(280, viewportHeight - safeMargin * 2);
      const left = Math.max(
        safeMargin,
        Math.min(rect.right - width, viewportWidth - width - safeMargin)
      );
      const top = Math.max(
        safeMargin,
        Math.min(rect.bottom + 8, viewportHeight - maxHeight - safeMargin)
      );

      setNotificationMenuPosition({
        top,
        left,
        width,
        maxHeight
      });
    },
    []
  );

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }

    updateNotificationPosition();
    window.addEventListener("resize", updateNotificationPosition);
    window.addEventListener("scroll", updateNotificationPosition, true);

    return () => {
      window.removeEventListener("resize", updateNotificationPosition);
      window.removeEventListener("scroll", updateNotificationPosition, true);
    };
  }, [isNotificationsOpen, updateNotificationPosition]);

  const hasProfiles = (profiles?.length ?? 0) > 0;
  const unreadNotificationCount = isNotificationsOpen
    ? 0
    : visibleNotifications.filter((item) => item.createdAt > notificationsReadAt).length;

  const handleNotificationButtonClick = () => {
    const willOpen = !isNotificationsOpenRef.current;

    updateNotificationPosition();

    if (willOpen) {
      const optimisticReadAt = Math.max(
        Date.now(),
        getLatestNotificationCreatedAt(visibleNotificationsRef.current)
      );
      commitNotificationsReadAt(optimisticReadAt);
    }

    setIsNotificationsOpen((current) => !current);

    const refreshPromise = loadNotifications(true);

    if (willOpen) {
      void refreshPromise.then((items) => {
        if (!isNotificationsOpenRef.current) {
          return;
        }

        const nextReadAt = Math.max(Date.now(), getLatestNotificationCreatedAt(items));
        commitNotificationsReadAt(nextReadAt);
      });
    }
  };

  if (isLoading && (!profiles || profiles.length === 0)) {
    return <FriendListLoadingState />;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-ink sm:text-sm">
              {copy.friendList.communityTitle}
            </p>
            {copy.friendList.communityDescription ? (
              <p className="mt-1 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
                {copy.friendList.communityDescription}
              </p>
            ) : null}
          </div>

          <button
            ref={notificationButtonRef}
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-soft transition active:scale-[0.98]"
            onClick={handleNotificationButtonClick}
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadNotificationCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {Math.min(unreadNotificationCount, 9)}
              </span>
            ) : null}
          </button>
        </div>

        {hasProfiles ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {profiles?.map((profile) => {
              const relationshipState: CommunityRelationshipState = acceptedFriendUserIdSet.has(
                profile.id
              )
                ? "accepted"
                : sentRequestUserIdSet.has(profile.id)
                  ? "sent"
                  : incomingRequestUserIdSet.has(profile.id)
                    ? "incoming"
                    : "none";

              console.log("community heart alreadySent decision", {
                profileId: profile.id,
                alreadyHeartSent: sentHeartUserIdSet.has(profile.id)
              });

              return (
                <CommunityProfileCard
                  alreadyHeartSent={sentHeartUserIdSet.has(profile.id)}
                  key={profile.id}
                  onHeartSent={(receiverUserId) => {
                    console.log("community heart local sent-state patch", {
                      receiverUserId,
                      alreadyHeartSentBefore: sentHeartUserIdSet.has(receiverUserId)
                    });
                    setSentHeartUserIds((current) =>
                      current.includes(receiverUserId) ? current : [...current, receiverUserId]
                    );
                  }}
                  profile={profile}
                  relationshipState={relationshipState}
                  onOpenProfile={(nextProfile) =>
                    setSelectedFriend(buildCommunityFriendListItem(nextProfile))
                  }
                  onRequestSent={onCommunityRequestSent}
                />
              );
            })}
          </div>
        ) : (
          <div className="friend-list-surface rounded-[16px] px-4 py-5 text-center shadow-soft">
            <p className="text-[15px] font-semibold text-ink sm:text-base">
              {copy.friendList.noCommunityUsers}
            </p>
            <p className="mt-1.5 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
              {copy.friendList.noCommunityUsersDescription}
            </p>
          </div>
        )}
      </div>

      {isNotificationsOpen &&
      notificationMenuPosition &&
      typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[140]">
              <button
                type="button"
                aria-label="Close community notifications"
                className="absolute inset-0"
                data-android-back-close="true"
                onClick={() => setIsNotificationsOpen(false)}
              />
              <div
                className="fixed z-[141] rounded-[18px] border border-slate-200 bg-white p-2 shadow-xl"
                style={{
                  top: notificationMenuPosition.top,
                  left: notificationMenuPosition.left,
                  width: notificationMenuPosition.width
                }}
              >
                <div className="px-1.5 py-1">
                  <p className="text-[12px] font-semibold text-ink sm:text-[13px]">
                    {copy.friendList.communityNotificationsTitle}
                  </p>
                </div>

                {visibleNotifications.length > 0 ? (
                  <div
                    className="space-y-1 overflow-y-auto"
                    style={{ maxHeight: notificationMenuPosition.maxHeight }}
                  >
                    {visibleNotifications.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[14px] border border-slate-200 bg-slate-50 px-2.5 py-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-slate-200 bg-brand-50 text-[12px] font-semibold text-brand-700">
                            {item.senderProfile.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.senderProfile.avatarUrl}
                                alt={`${item.senderProfile.displayName} avatar`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (item.senderProfile.displayName.charAt(0) || "J").toUpperCase()
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] leading-5 text-slate-700 sm:text-[12px]">
                              {copy.friendList.communityHeartReceived.replace(
                                "{name}",
                                item.senderProfile.displayName
                              )}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {formatNotificationTimestamp(locale, item.createdAt)}
                            </p>
                            <div className="mt-2 w-full">
                              <CommunityNotificationRequestButton
                                notification={item}
                                relationshipState={
                                  acceptedFriendUserIdSet.has(item.senderUserId)
                                    ? "accepted"
                                    : sentRequestUserIdSet.has(item.senderUserId)
                                      ? "sent"
                                      : incomingRequestUserIdSet.has(item.senderUserId)
                                        ? "incoming"
                                        : "none"
                                }
                                onRequestSent={onCommunityRequestSent}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-4 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
                    {copy.friendList.communityNotificationsEmpty}
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}

      <FriendProfileDetail
        friend={selectedFriend}
        onClose={() => setSelectedFriend(null)}
        bottomContent={
          selectedFriend ? <ProfileReviewList targetUserId={selectedFriend.profile.id} /> : null
        }
      />
    </>
  );
}
