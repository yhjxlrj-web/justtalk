import { ChatListLoadingState } from "@/components/home/chat-list";
import { GlassCard } from "@/components/ui/glass-card";

export default function ChatLoadingPage() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-3.5">
        <GlassCard className="px-5 py-5 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-700/75">
            JustTalk
          </p>
          <p className="mt-1 text-sm text-slate-500">채팅을 불러오는 중...</p>
        </GlassCard>
        <ChatListLoadingState />
      </div>
      <GlassCard className="p-5 sm:p-6">
        <div className="space-y-3">
          <div className="h-5 w-32 animate-pulse rounded-full bg-brand-100/70" />
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-[22px] border border-slate-200 bg-white"
            />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
