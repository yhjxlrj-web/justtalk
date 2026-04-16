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

// ✅ 추가된 부분 (푸시)
import { setupPush } from "@/lib/push/setup-push";

import type { CommunityProfileItem } from "@/types/community";
import type { FriendCollections, FriendListItem } from "@/types/friends";
import type { ChatRoomPreview } from "@/types/home";
import type { UserProfile } from "@/types/profile";

const COMMUNITY_MINUTE_REFRESH_INTERVAL_MS = 60_000;

// (중간 코드 생략 없음 — 그대로 유지됨)

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

  // ✅ 여기 추가 (핵심)
  useEffect(() => {
  if (!userId) return;

  setupPush({ userId });
}, [userId]);

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
  PUSH TEST
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
    </div>
  );
}