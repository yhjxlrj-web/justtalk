export function ChatRoomLoading() {
  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent">
      <div className="flex items-center justify-between gap-4 bg-transparent px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
          <div className="h-10 w-10 animate-pulse rounded-[16px] bg-brand-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded-full bg-brand-100" />
            <div className="h-3 w-40 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      </div>

      <div className="chat-room-pattern flex-1 space-y-3 px-3 py-3 sm:px-4 sm:py-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={item === 1 ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[80%]">
              <div className="h-12 animate-pulse rounded-[18px] bg-white shadow-soft" />
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 bg-transparent px-3 py-2.5">
        <div className="flex items-center gap-1 bg-transparent p-0">
          <div className="h-[27px] flex-1 animate-pulse rounded-full bg-slate-200" />
          <div className="h-[27px] w-[58px] animate-pulse rounded-full bg-brand-100" />
        </div>
      </div>
    </div>
  );
}
