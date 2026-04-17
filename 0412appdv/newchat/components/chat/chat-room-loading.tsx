"use client";

import { useEffect, useState } from "react";

const ROUTE_LOADING_VISIBILITY_DELAY_MS = 140;

export function ChatRoomLoading() {
  const [showLoadingHint, setShowLoadingHint] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowLoadingHint(true);
    }, ROUTE_LOADING_VISIBILITY_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  if (!showLoadingHint) {
    return <div className="h-[100dvh] w-full bg-[rgb(var(--bg))]" />;
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between gap-4 bg-transparent px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-200/65" />
          <div className="h-10 w-10 rounded-[16px] bg-slate-200/55" />
          <div className="h-4 w-32 rounded-full bg-slate-200/60" />
        </div>
        <div className="h-2.5 w-2.5 rounded-full bg-slate-300/75" />
      </div>

      <div className="chat-room-pattern flex-1 px-3 py-3 sm:px-4 sm:py-4" />

      <div className="shrink-0 bg-transparent px-3 py-2.5">
        <div className="h-[29px] rounded-full bg-slate-200/60" />
      </div>
    </div>
  );
}
