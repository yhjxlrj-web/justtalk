import { AddFriendCard } from "@/components/home/add-friend-card";
import { FriendListLoadingState } from "@/components/home/friend-list";
import { GlassCard } from "@/components/ui/glass-card";

export default function HomeLoadingPage() {
  return (
    <div className="space-y-5">
      <GlassCard className="overflow-hidden px-5 py-6 sm:px-7">
        <div className="space-y-3">
          <div className="h-10 w-64 animate-pulse rounded-full bg-brand-100/70" />
          <div className="h-4 w-full max-w-2xl animate-pulse rounded-full bg-slate-200/80" />
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 animate-pulse rounded-[22px] bg-brand-100/70" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-40 animate-pulse rounded-full bg-brand-100/70" />
                <div className="h-4 w-52 animate-pulse rounded-full bg-slate-200/80" />
                <div className="flex gap-2">
                  <div className="h-7 w-24 animate-pulse rounded-full bg-slate-200/80" />
                  <div className="h-7 w-28 animate-pulse rounded-full bg-slate-200/80" />
                </div>
              </div>
            </div>
          </GlassCard>
          <AddFriendCard />
        </div>

        <FriendListLoadingState />
      </div>
    </div>
  );
}
