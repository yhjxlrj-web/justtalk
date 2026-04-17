"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getCachedChatPreviews } from "@/components/home/chat-preview-cache";
import { ChatListLoadingState } from "@/components/home/chat-list";
import { FriendListLoadingState } from "@/components/home/friend-list";
import { GlassCard } from "@/components/ui/glass-card";

const HOME_LOADING_VISIBILITY_DELAY_MS = 150;

type HomeLoadingTab = "friends" | "chats" | "settings";

function resolveHomeLoadingTab(tab: string | null): HomeLoadingTab {
  if (tab === "chats" || tab === "settings") {
    return tab;
  }

  return "friends";
}

function HomeHeroLoading() {
  return (
    <GlassCard className="overflow-hidden border border-slate-200 bg-[rgb(var(--surface-strong))] px-4 py-3 shadow-sm sm:px-5 sm:py-4 lg:px-5 lg:py-4 lg:shadow-md">
      <div className="space-y-2.5">
        <div className="h-7 w-40 rounded-full bg-slate-200/70 sm:h-9 sm:w-56" />
        <div className="h-3 w-full max-w-xl rounded-full bg-slate-200/55 sm:h-4 sm:max-w-2xl" />
      </div>
    </GlassCard>
  );
}

function FriendsTabLoading() {
  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-soft">
        <div className="h-8 w-[112px] rounded-full bg-slate-200/70" />
        <div className="h-8 w-[112px] rounded-full bg-slate-100/75" />
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[0.95fr_1.05fr] xl:gap-4">
        <div className="space-y-3.5 sm:space-y-4">
          <FriendListLoadingState delayMs={0} />
          <GlassCard className="rounded-[18px] border border-slate-200 bg-[rgb(var(--surface-strong))] p-3.5 shadow-soft">
            <div className="space-y-3">
              <div className="h-3.5 w-24 rounded-full bg-slate-200/70" />
              <div className="h-3 w-48 rounded-full bg-slate-200/55" />
              <div className="h-10 w-full rounded-[16px] bg-slate-200/60" />
            </div>
          </GlassCard>
        </div>

        <div className="space-y-3.5 sm:space-y-4">
          <FriendListLoadingState delayMs={0} />
        </div>
      </div>
    </div>
  );
}

function ChatsTabLoading({ warmReturn }: { warmReturn: boolean }) {
  if (warmReturn) {
    return <div className="h-10" />;
  }

  return <ChatListLoadingState delayMs={0} rowCount={5} />;
}

function SettingsTabLoading() {
  return (
    <div className="grid w-full gap-3.5 sm:gap-4">
      {[0, 1, 2].map((item) => (
        <GlassCard
          key={item}
          className="rounded-[18px] border border-slate-200 bg-[rgb(var(--surface-strong))] p-3.5 shadow-soft"
        >
          <div className="space-y-3">
            <div className="h-4 w-24 rounded-full bg-slate-200/70" />
            <div className="h-3 w-48 rounded-full bg-slate-200/55" />
            <div className="h-11 w-full rounded-[16px] bg-slate-200/60" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export default function HomeLoadingPage() {
  const searchParams = useSearchParams();
  const [showSkeleton, setShowSkeleton] = useState(false);
  const activeTab = useMemo(
    () => resolveHomeLoadingTab(searchParams.get("tab")),
    [searchParams]
  );
  const hasWarmChatPreviewCache = (getCachedChatPreviews()?.length ?? 0) > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSkeleton(true);
    }, HOME_LOADING_VISIBILITY_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-none overflow-x-hidden space-y-3 pb-24 sm:space-y-4">
      <div className="px-2.5 sm:px-4 lg:px-5">
        <HomeHeroLoading />
      </div>

      <div className="px-2.5 sm:px-4 lg:px-5">
        {showSkeleton ? (
          activeTab === "friends" ? (
            <FriendsTabLoading />
          ) : activeTab === "chats" ? (
            <ChatsTabLoading warmReturn={hasWarmChatPreviewCache} />
          ) : (
            <SettingsTabLoading />
          )
        ) : (
          <div className="h-[220px]" />
        )}
      </div>
    </div>
  );
}
