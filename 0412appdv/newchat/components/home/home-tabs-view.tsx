"use client";

import { Heart, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AddFriendCard } from "@/components/home/add-friend-card";
import { clearCachedRoomEntrySnapshot } from "@/components/chat/room-entry-cache";
import { clearCachedRoomMessages } from "@/components/chat/room-message-cache";
import { CommunityList } from "@/components/home/community-list";
import {
  getCachedCommunityProfiles,
  getCommunityRefreshDateKey,
  isCommunityCacheFresh,
  setCachedCommunityProfiles
} from "@/components/home/community-cache";
import {
  getCachedChatPreviews,
  removeCachedDirectChatPreviewsByPeerUserId
} from "@/components/home/chat-preview-cache";
import { ChatListLoadingState } from "@/components/home/chat-list";
import { FriendList, FriendListLoadingState } from "@/components/home/friend-list";
import { ProfileCard } from "@/components/home/profile-card";
import { RealtimeChatList } from "@/components/home/realtime-chat-list";
import { HomeSettingsPanel } from "@/components/home/settings-panel";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import { useHomeTabs, type HomeTab } from "@/components/providers/home-tab-provider";
import { GlassCard } from "@/components/ui/glass-card";
import {
  COMMUNITY_PROFILE_LIMIT,
  getCommunityProfiles,
  sortCommunityProfiles
} from "@/lib/community/community";
import { getUiCopy } from "@/lib/i18n/ui-copy";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { CommunityProfileItem } from "@/types/community";
import type { FriendCollections, FriendListItem } from "@/types/friends";
import type { ChatRoomPreview } from "@/types/home";
import type { UserProfile } from "@/types/profile";

const COMMUNITY_MINUTE_REFRESH_INTERVAL_MS = 60_000;

type FriendsSubview = "community" | "friends";

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

function buildPendingCommunityFriendListItem(params: {
  friendshipId: string;
  profile: CommunityProfileItem;
  userId: string;
}) {
  return {
    relationship: {
      id: params.friendshipId,
      requesterId: params.userId,
      addresseeId: params.profile.id,
      status: "pending" as const
    },
    profile: {
      id: params.profile.id,
      email: params.profile.email,
      displayName: params.profile.displayName,
      statusMessage: params.profile.statusMessage,
      country: params.profile.country,
      preferredLanguage: params.profile.preferredLanguage,
      avatarUrl: params.profile.avatarUrl,
      lastActiveAt: params.profile.lastActiveAt,
      showLastSeen: params.profile.showLastSeen
    },
    direction: "outgoing" as const
  } satisfies FriendListItem;
}

function TabPanel({
  active,
  children,
  id
}: {
  active: boolean;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <section id={id} aria-hidden={!active} className={active ? "block" : "hidden"}>
      {children}
    </section>
  );
}

function HomeSectionLoadingBar() {
  return (
    <div
      className="mb-3.5 h-[2px] w-full overflow-hidden rounded-full bg-slate-200 sm:mb-4"
      aria-label="Loading tab data"
      role="status"
    >
      <div className="home-loading-bar h-full w-24 rounded-full bg-brand-400" />
    </div>
  );
}

const FriendsPanel = memo(function FriendsPanel({
  onBlockedPeerIdsChange,
  friends,
  userId
}: {
  onBlockedPeerIdsChange: (action: "block" | "unblock", otherUserId: string) => void;
  friends: FriendCollections | null;
  userId: string;
}) {
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [friendsState, setFriendsState] = useState<FriendCollections | null>(friends);
  const [activeSubview, setActiveSubview] = useState<FriendsSubview>("friends");
  const [communityProfiles, setCommunityProfiles] = useState<CommunityProfileItem[] | null>(() => {
    const cachedEntry = getCachedCommunityProfiles(userId);
    return cachedEntry?.profiles ?? null;
  });
  const [communityHasOverflow, setCommunityHasOverflow] = useState(() => {
    const cachedEntry = getCachedCommunityProfiles(userId);
    return cachedEntry?.hasOverflow ?? false;
  });
  const [isCommunityLoading, setIsCommunityLoading] = useState(() => {
    const cachedEntry = getCachedCommunityProfiles(userId);
    return !cachedEntry;
  });
  const communityFetchPromiseRef = useRef<Promise<{
    hasOverflow: boolean;
    profiles: CommunityProfileItem[];
  }> | null>(null);
  const isMountedRef = useRef(true);
  const handledCommunityRequestRef = useRef<string | null>(null);
  const acceptedFriendIdSet = useMemo(
    () => new Set((friendsState?.acceptedFriends ?? []).map((item) => item.profile.id)),
    [friendsState?.acceptedFriends]
  );
  const sentRequestUserIdSet = useMemo(
    () => new Set((friendsState?.sentRequests ?? []).map((item) => item.profile.id)),
    [friendsState?.sentRequests]
  );
  const incomingRequestUserIdSet = useMemo(
    () => new Set((friendsState?.incomingRequests ?? []).map((item) => item.profile.id)),
    [friendsState?.incomingRequests]
  );
  const blockedProfileIdSet = useMemo(
    () => new Set((friendsState?.blockedUsers ?? []).map((item) => item.profile.id)),
    [friendsState?.blockedUsers]
  );

  useEffect(() => {
    setFriendsState(friends);
  }, [friends]);

  const normalizeCommunityProfiles = useMemo(
    () => (profiles: CommunityProfileItem[]) =>
      sortCommunityProfiles(
        profiles.filter(
          (profile) =>
            profile.id !== userId &&
            !acceptedFriendIdSet.has(profile.id) &&
            !blockedProfileIdSet.has(profile.id) &&
            !sentRequestUserIdSet.has(profile.id) &&
            !incomingRequestUserIdSet.has(profile.id)
        )
      ).slice(0, COMMUNITY_PROFILE_LIMIT),
    [acceptedFriendIdSet, blockedProfileIdSet, incomingRequestUserIdSet, sentRequestUserIdSet, userId]
  );

  const persistCommunityProfiles = useMemo(
    () =>
      (
        result: {
          hasOverflow: boolean;
          profiles: CommunityProfileItem[];
        },
        fetchedAt = Date.now()
      ) => {
        const normalizedProfiles = normalizeCommunityProfiles(result.profiles);

        if (isMountedRef.current) {
          setCommunityProfiles(normalizedProfiles);
          setCommunityHasOverflow(result.hasOverflow);
        }

        setCachedCommunityProfiles(userId, {
          fetchedAt,
          hasOverflow: result.hasOverflow,
          profiles: normalizedProfiles,
          refreshDate: getCommunityRefreshDateKey(new Date(fetchedAt))
        });

        return normalizedProfiles;
      },
    [normalizeCommunityProfiles, userId]
  );

  const updateCommunityProfiles = useMemo(
    () => (updater: (current: CommunityProfileItem[] | null) => CommunityProfileItem[] | null) => {
      setCommunityProfiles((current) => {
        const nextProfiles = updater(current);

        if (!nextProfiles) {
          return current;
        }

        const fetchedAt = Date.now();
        const normalizedProfiles = normalizeCommunityProfiles(nextProfiles);
        setCachedCommunityProfiles(userId, {
          fetchedAt,
          hasOverflow: communityHasOverflow,
          profiles: normalizedProfiles,
          refreshDate: getCommunityRefreshDateKey(new Date(fetchedAt))
        });
        return normalizedProfiles;
      });
    },
    [communityHasOverflow, normalizeCommunityProfiles, userId]
  );

  const loadCommunityProfiles = useMemo(
    () => async (force = false) => {
      const cachedEntry = getCachedCommunityProfiles(userId);
      const hasCachedProfiles = (cachedEntry?.profiles.length ?? 0) > 0;

      if (cachedEntry) {
        setCommunityProfiles(cachedEntry.profiles);
        setCommunityHasOverflow(cachedEntry.hasOverflow ?? false);

        if (!force && isCommunityCacheFresh(cachedEntry)) {
          setIsCommunityLoading(false);
          return {
            hasOverflow: cachedEntry.hasOverflow ?? false,
            profiles: cachedEntry.profiles
          };
        }
      }

      if (!force && communityFetchPromiseRef.current) {
        return communityFetchPromiseRef.current;
      }

      if (!hasCachedProfiles) {
        setIsCommunityLoading(true);
      }

      const fetchPromise = getCommunityProfiles(supabase, userId, {
        excludeUserIds: Array.from(
          new Set([
            ...acceptedFriendIdSet,
            ...blockedProfileIdSet,
            ...sentRequestUserIdSet,
            ...incomingRequestUserIdSet
          ])
        ),
        limit: COMMUNITY_PROFILE_LIMIT
      })
        .then((result) => {
          console.log("community profiles loaded", {
            userId,
            count: result.profiles.length,
            hasOverflow: result.hasOverflow
          });
          persistCommunityProfiles(result);
          return result;
        })
        .catch((error) => {
          console.error("Failed to load community profiles", {
            userId,
            error
          });

          return {
            hasOverflow: cachedEntry?.hasOverflow ?? false,
            profiles: cachedEntry?.profiles ?? []
          };
        })
        .finally(() => {
          if (communityFetchPromiseRef.current === fetchPromise) {
            communityFetchPromiseRef.current = null;
          }

          if (isMountedRef.current) {
            setIsCommunityLoading(false);
          }
        });

      communityFetchPromiseRef.current = fetchPromise;
      return fetchPromise;
    },
    [
      acceptedFriendIdSet,
      blockedProfileIdSet,
      incomingRequestUserIdSet,
      persistCommunityProfiles,
      sentRequestUserIdSet,
      supabase,
      userId
    ]
  );

  useEffect(() => {
    isMountedRef.current = true;

    void loadCommunityProfiles();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadCommunityProfiles]);

  useEffect(() => {
    setCommunityProfiles((current) => (current ? normalizeCommunityProfiles(current) : current));
  }, [normalizeCommunityProfiles]);

  useEffect(() => {
    if (!communityProfiles || communityHasOverflow) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadCommunityProfiles(true);
    }, COMMUNITY_MINUTE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [communityHasOverflow, communityProfiles, loadCommunityProfiles]);

  const handleCommunityRequestSent = useCallback(
    (params: {
      friendshipId: string;
      otherUserId: string;
      profile: CommunityProfileItem;
    }) => {
      const handledKey = `${params.friendshipId}:${params.otherUserId}`;

      if (handledCommunityRequestRef.current === handledKey) {
        console.log("handleCommunityRequestSent skipped duplicate success", {
          friendshipId: params.friendshipId,
          otherUserId: params.otherUserId
        });
        return;
      }

      handledCommunityRequestRef.current = handledKey;

      setFriendsState((current) => {
        if (!current) {
          return current;
        }

        const alreadyExists = current.sentRequests.some(
          (item) =>
            item.relationship.id === params.friendshipId || item.profile.id === params.otherUserId
        );

        console.log("handleCommunityRequestSent patch", {
          friendshipId: params.friendshipId,
          otherUserId: params.otherUserId,
          sentRequestsLengthBefore: current.sentRequests.length,
          alreadyExists
        });

        if (alreadyExists) {
          return current;
        }

        return {
          ...current,
          sentRequests: [
            buildPendingCommunityFriendListItem({
              friendshipId: params.friendshipId,
              profile: params.profile,
              userId
            }),
            ...current.sentRequests
          ]
        };
      });

      updateCommunityProfiles((current) =>
        current ? current.filter((profile) => profile.id !== params.otherUserId) : current
      );
    },
    [updateCommunityProfiles, userId]
  );

  if (!friends) {
    return (
      <>
        <HomeSectionLoadingBar />
        <div className="grid gap-3.5 xl:grid-cols-[0.95fr_1.05fr] xl:gap-4">
          <div className="space-y-3.5 sm:space-y-4">
            <FriendListLoadingState />
            <GlassCard className="rounded-[18px] border border-slate-200 bg-[rgb(var(--surface-strong))] p-3.5 shadow-soft">
              <div className="space-y-3">
                <div className="h-3.5 w-24 animate-pulse rounded-full bg-brand-100" />
                <div className="h-3 w-48 animate-pulse rounded-full bg-slate-200" />
                <div className="h-10 w-full animate-pulse rounded-[16px] bg-brand-100" />
              </div>
            </GlassCard>
          </div>

          <div className="space-y-3.5 sm:space-y-4">
            <FriendListLoadingState />
          </div>
        </div>
      </>
    );
  }

  const handleFriendshipDecision = (params: {
    decision: "accepted" | "rejected";
    friendshipId: string;
  }) => {
    const acceptedRequest = friendsState?.incomingRequests.find(
      (item) => item.relationship.id === params.friendshipId
    );

    setFriendsState((current) => {
      if (!current) {
        return current;
      }

      const currentAcceptedRequest =
        acceptedRequest ??
        current.incomingRequests.find((item) => item.relationship.id === params.friendshipId);

      return {
        ...current,
        incomingRequests: current.incomingRequests.filter(
          (item) => item.relationship.id !== params.friendshipId
        ),
        acceptedFriends:
          params.decision === "accepted" && currentAcceptedRequest
            ? [
                {
                  ...currentAcceptedRequest,
                  relationship: {
                    ...currentAcceptedRequest.relationship,
                    status: "accepted"
                  }
                },
                ...current.acceptedFriends
              ]
            : current.acceptedFriends
      };
    });

    if (params.decision === "accepted" && acceptedRequest) {
      updateCommunityProfiles((current) =>
        current ? current.filter((profile) => profile.id !== acceptedRequest.profile.id) : current
      );
    }
  };

  const handleFriendMutation = (params: {
    action: "block" | "unblock";
    friendshipId: string;
    otherUserId: string;
    friend?: FriendListItem;
  }) => {
    console.log("handleFriendMutation start", {
      action: params.action,
      friendshipId: params.friendshipId,
      otherUserId: params.otherUserId,
      acceptedFriendsLengthBefore: friendsState?.acceptedFriends.length ?? 0,
      incomingRequestsLengthBefore: friendsState?.incomingRequests.length ?? 0,
      sentRequestsLengthBefore: friendsState?.sentRequests.length ?? 0,
      blockedUsersLengthBefore: friendsState?.blockedUsers.length ?? 0
    });

    setFriendsState((current) => {
      if (!current) {
        return current;
      }

      if (params.action === "unblock") {
        const nextBlockedUsers = current.blockedUsers.filter(
          (item) =>
            item.relationship.id !== params.friendshipId &&
            item.profile.id !== params.otherUserId
        );
        const hasAcceptedFriend = current.acceptedFriends.some(
          (item) =>
            item.relationship.id === params.friendshipId ||
            item.profile.id === params.otherUserId
        );
        const nextAcceptedFriends =
          !hasAcceptedFriend && params.friend
            ? [params.friend, ...current.acceptedFriends]
            : current.acceptedFriends;

        console.log("handleFriendMutation unblock patch", {
          friendshipId: params.friendshipId,
          otherUserId: params.otherUserId,
          acceptedFriendsLengthAfter: nextAcceptedFriends.length,
          blockedUsersLengthAfter: nextBlockedUsers.length
        });

        return {
          ...current,
          acceptedFriends: nextAcceptedFriends,
          blockedUsers: nextBlockedUsers
        };
      }

      const nextState = {
        ...current,
        incomingRequests: current.incomingRequests.filter(
          (item) =>
            item.relationship.id !== params.friendshipId &&
            item.profile.id !== params.otherUserId
        ),
        sentRequests: current.sentRequests.filter(
          (item) =>
            item.relationship.id !== params.friendshipId &&
            item.profile.id !== params.otherUserId
        ),
        acceptedFriends: current.acceptedFriends.filter(
          (item) =>
            item.relationship.id !== params.friendshipId &&
            item.profile.id !== params.otherUserId
        ),
        blockedUsers: current.blockedUsers.filter(
          (item) =>
            item.relationship.id !== params.friendshipId &&
            item.profile.id !== params.otherUserId
        )
      };

        const nextBlockedUsers =
          params.action === "block" && params.friend
            ? (() => {
                const alreadyExists = nextState.blockedUsers.some(
                  (item) =>
                    item.relationship.id === params.friendshipId ||
                    item.profile.id === params.otherUserId
                );

                if (alreadyExists) {
                  return nextState.blockedUsers;
                }

                return [
                  buildBlockedFriendListItem({
                    friend: params.friend,
                    friendshipId: params.friendshipId,
                    otherUserId: params.otherUserId
                  }),
                  ...nextState.blockedUsers
                ];
              })()
            : nextState.blockedUsers;

        console.log("handleFriendMutation friends patch", {
          action: params.action,
          friendshipId: params.friendshipId,
          otherUserId: params.otherUserId,
          acceptedFriendsLengthAfter: nextState.acceptedFriends.length,
          incomingRequestsLengthAfter: nextState.incomingRequests.length,
          sentRequestsLengthAfter: nextState.sentRequests.length,
          blockedUsersLengthAfter: nextBlockedUsers.length
        });

        return {
          ...nextState,
          blockedUsers: nextBlockedUsers
        };
      });

    if (params.action === "block") {
      updateCommunityProfiles((current) =>
        current ? current.filter((profile) => profile.id !== params.otherUserId) : current
      );
    }

    if (params.action === "unblock") {
      onBlockedPeerIdsChange("unblock", params.otherUserId);
      return;
    }

    onBlockedPeerIdsChange("block", params.otherUserId);

    const removedPreviews = removeCachedDirectChatPreviewsByPeerUserId(params.otherUserId);
    const removedRoomIds = removedPreviews.map((preview) => preview.roomId);

    console.log("handleFriendMutation chat preview removal", {
      action: params.action,
      friendshipId: params.friendshipId,
      otherUserId: params.otherUserId,
      removedPreviewRoomIds: removedRoomIds,
      removedPreviewCount: removedPreviews.length,
      remainingPreviewCount: getCachedChatPreviews()?.length ?? 0
    });

    for (const roomId of removedRoomIds) {
      clearCachedRoomMessages(roomId);
      clearCachedRoomEntrySnapshot(roomId);
    }
  };

  const segmentButtonClassName = (tab: FriendsSubview) =>
    cn(
      "inline-flex min-w-[110px] items-center justify-center rounded-full px-4 py-2 text-[13px] font-medium transition",
      activeSubview === tab
        ? "bg-brand-500 text-white shadow-float"
        : "bg-transparent text-slate-600 hover:bg-slate-50"
    );

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-soft">
        <button
          type="button"
          className={segmentButtonClassName("community")}
          onClick={() => setActiveSubview("community")}
        >
          <span className="inline-flex items-center gap-1 text-pink-500">
            <span>{copy.friendList.communityTab}</span>
            <Heart className="h-3.5 w-3.5 fill-current" />
          </span>
        </button>
        <button
          type="button"
          className={segmentButtonClassName("friends")}
          onClick={() => setActiveSubview("friends")}
        >
          {copy.hero.friendsTitle}
        </button>
      </div>

      <section
        aria-hidden={activeSubview !== "community"}
        className={activeSubview === "community" ? "block" : "hidden"}
      >
        <CommunityList
          acceptedFriendUserIds={Array.from(acceptedFriendIdSet)}
          blockedUserIds={Array.from(blockedProfileIdSet)}
          incomingRequestUserIds={friendsState?.incomingRequests.map((item) => item.profile.id) ?? []}
          profiles={communityProfiles}
          isLoading={isCommunityLoading}
          onCommunityRequestSent={handleCommunityRequestSent}
          sentRequestUserIds={friendsState?.sentRequests.map((item) => item.profile.id) ?? []}
          userId={userId}
        />
      </section>

      <section aria-hidden={activeSubview !== "friends"} className={activeSubview === "friends" ? "block" : "hidden"}>
        <div className="grid gap-3.5 xl:grid-cols-[0.95fr_1.05fr] xl:gap-4">
          <div className="space-y-3.5 sm:space-y-4">
            <FriendList
              incomingRequests={[]}
              sentRequests={[]}
              acceptedFriends={friendsState?.acceptedFriends ?? []}
              blockedUsers={[]}
              showIncomingRequests={false}
              showSentRequests={false}
              showBlockedUsers={false}
              onFriendMutation={handleFriendMutation}
            />
            <AddFriendCard />
          </div>

          <div className="space-y-3.5 sm:space-y-4">
            <FriendList
              incomingRequests={friendsState?.incomingRequests ?? []}
              sentRequests={friendsState?.sentRequests ?? []}
              acceptedFriends={[]}
              blockedUsers={[]}
              showAcceptedFriends={false}
              showBlockedUsers={false}
              onFriendshipDecision={handleFriendshipDecision}
            />
          </div>

          <FriendList
            incomingRequests={[]}
            sentRequests={[]}
            acceptedFriends={[]}
            blockedUsers={friendsState?.blockedUsers ?? []}
            showIncomingRequests={false}
            showSentRequests={false}
            showAcceptedFriends={false}
            onFriendMutation={handleFriendMutation}
          />
        </div>
      </section>
    </div>
  );
});

const ChatsPanel = memo(function ChatsPanel({
  blockedPeerUserIds,
  chats,
  isVisible,
  viewerId
}: {
  blockedPeerUserIds: string[];
  chats: ChatRoomPreview[] | null;
  isVisible: boolean;
  viewerId: string;
}) {
  if (!chats) {
    return (
      <>
        <HomeSectionLoadingBar />
        <ChatListLoadingState />
      </>
    );
  }

  return (
    <RealtimeChatList
      initialChats={chats}
      blockedPeerUserIds={blockedPeerUserIds}
      isVisible={isVisible}
      viewerId={viewerId}
    />
  );
});

const SettingsPanel = memo(function SettingsPanel({
  currentUserEmail,
  isVisible,
  onProfileUpdated,
  profile
}: {
  currentUserEmail: string;
  isVisible: boolean;
  profile: UserProfile | null;
  onProfileUpdated: (profile: UserProfile) => void;
}) {
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const [isDeveloperAdminSubview, setIsDeveloperAdminSubview] = useState(false);

  if (!profile) {
    return (
      <>
        <HomeSectionLoadingBar />
        <div className="grid w-full gap-3.5 sm:gap-4">
          {[0, 1, 2].map((item) => (
            <GlassCard
              key={item}
              className="rounded-[18px] border border-slate-200 bg-[rgb(var(--surface-strong))] p-3.5 shadow-soft"
            >
              <div className="space-y-3">
                <div className="h-4 w-24 animate-pulse rounded-full bg-brand-100" />
                <div className="h-3 w-48 animate-pulse rounded-full bg-slate-200" />
                <div className="h-11 w-full animate-pulse rounded-[16px] bg-slate-200" />
              </div>
            </GlassCard>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="grid w-full gap-3.5 sm:gap-4">
      <ProfileCard profile={profile} />
      <HomeSettingsPanel
        currentUserEmail={currentUserEmail}
        isVisible={isVisible}
        onAdminSubviewChange={setIsDeveloperAdminSubview}
        profile={profile}
        onProfileUpdated={onProfileUpdated}
      />
      {!isDeveloperAdminSubview ? (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold text-ink sm:text-sm">
            {copy.settings.accountNotesTitle}
          </p>
          <div className="space-y-2.5">
            {copy.settings.accountNoteItems.filter(Boolean).map((item) => (
              <div
                key={item}
                className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-2.5 text-[12px] leading-5 text-slate-600 shadow-soft sm:text-sm sm:leading-6"
              >
                {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item) ? (
                  <a
                    href={`mailto:${item}`}
                    className="font-medium text-brand-700 underline-offset-4 hover:underline"
                  >
                    {item}
                  </a>
                ) : (
                  item
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export function HomeTabsView({
  initialChats,
  initialFriends,
  initialProfile,
  initialTab,
  userEmail,
  userId
}: {
  initialChats: ChatRoomPreview[];
  initialFriends: FriendCollections;
  initialProfile: UserProfile | null;
  initialTab: HomeTab;
  userEmail: string;
  userId: string;
}) {
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const router = useRouter();
  const { activeTab, setActiveTab } = useHomeTabs();
  const [hasSyncedInitialTab, setHasSyncedInitialTab] = useState(false);
  const [isHomeRefreshing, startHomeRefresh] = useTransition();
  const [friendsCache, setFriendsCache] = useState<FriendCollections | null>(initialFriends);
  const [chatsCache, setChatsCache] = useState<ChatRoomPreview[] | null>(initialChats);
  const [blockedPeerUserIds, setBlockedPeerUserIds] = useState<string[]>(
    () => initialFriends.blockedUsers.map((item) => item.profile.id)
  );
  const [settingsCache, setSettingsCache] = useState<UserProfile | null>(initialProfile);
  const hasStartedBackgroundRefreshRef = useRef(false);
  const scrollPositionsRef = useRef<Record<HomeTab, number>>({
    friends: 0,
    chats: 0,
    settings: 0
  });
  const previousTabRef = useRef<HomeTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
    setHasSyncedInitialTab(true);
  }, [initialTab, setActiveTab]);

  useEffect(() => {
    setFriendsCache(initialFriends);
  }, [initialFriends]);

  useEffect(() => {
    setChatsCache(initialChats);
  }, [initialChats]);

  useEffect(() => {
    setBlockedPeerUserIds(initialFriends.blockedUsers.map((item) => item.profile.id));
  }, [initialFriends]);

  useEffect(() => {
    setSettingsCache(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (hasStartedBackgroundRefreshRef.current) {
      return;
    }

    hasStartedBackgroundRefreshRef.current = true;
    startHomeRefresh(() => {
      router.refresh();
    });
  }, [router]);

  const visibleTab = hasSyncedInitialTab ? activeTab : initialTab;

  useEffect(() => {
    const previousTab = previousTabRef.current;

    if (previousTab === visibleTab) {
      return;
    }

    scrollPositionsRef.current[previousTab] = window.scrollY;
    const nextScrollTop = scrollPositionsRef.current[visibleTab] ?? 0;
    previousTabRef.current = visibleTab;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollTop, behavior: "auto" });
    });
  }, [visibleTab]);

  const heroContent = useMemo(
    () =>
      ({
        friends: {
          title: copy.hero.friendsTitle,
          description: copy.hero.friendsDescription
        },
        chats: {
          title: copy.hero.chatsTitle,
          description: copy.hero.chatsDescription
        },
        settings: {
          title: copy.hero.settingsTitle,
          description: copy.hero.settingsDescription
        }
      })[visibleTab],
    [copy.hero, visibleTab]
  );
  const sharedInsetClass = "px-2.5 sm:px-4 lg:px-5";

  return (
    <div className="mx-auto w-full max-w-none overflow-x-hidden space-y-3 pb-24 sm:space-y-4">
      <div className={sharedInsetClass}>
        <GlassCard className="overflow-hidden border border-slate-200 bg-[rgb(var(--surface-strong))] px-4 py-3 shadow-sm sm:px-5 sm:py-4 lg:px-5 lg:py-4 lg:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[1.45rem] font-semibold text-slate-900 sm:text-4xl">
              {heroContent.title}
            </h1>
            <div className="min-h-[28px] shrink-0">
              {isHomeRefreshing ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-soft sm:text-[12px]">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  <span>{copy.hero.refreshing}</span>
                </div>
              ) : null}
            </div>
          </div>
          {heroContent.description ? (
            <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-slate-600 sm:mt-3 sm:text-base sm:leading-7">
              {heroContent.description}
            </p>
          ) : null}
        </GlassCard>
      </div>

      <TabPanel active={visibleTab === "friends"} id="home-tab-friends">
        <div className={sharedInsetClass}>
          <FriendsPanel
            friends={friendsCache}
            onBlockedPeerIdsChange={(action, otherUserId) => {
              setBlockedPeerUserIds((current) => {
                if (action === "block") {
                  return current.includes(otherUserId) ? current : [...current, otherUserId];
                }

                return current.filter((userId) => userId !== otherUserId);
              });
            }}
            userId={userId}
          />
        </div>
      </TabPanel>

      <TabPanel active={visibleTab === "chats"} id="home-tab-chats">
        <div className={sharedInsetClass}>
          <ChatsPanel
            blockedPeerUserIds={blockedPeerUserIds}
            chats={chatsCache}
            isVisible={visibleTab === "chats"}
            viewerId={userId}
          />
        </div>
      </TabPanel>

      <TabPanel active={visibleTab === "settings"} id="home-tab-settings">
        <div className={sharedInsetClass}>
          <SettingsPanel
            currentUserEmail={userEmail}
            isVisible={visibleTab === "settings"}
            onProfileUpdated={(profile) => {
              setSettingsCache(profile);
            }}
            profile={settingsCache ?? null}
          />
        </div>
      </TabPanel>
    </div>
  );
}
