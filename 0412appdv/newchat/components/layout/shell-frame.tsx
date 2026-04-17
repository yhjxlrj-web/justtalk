"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AndroidBackButtonHandler } from "@/components/layout/android-back-button-handler";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { cn } from "@/lib/utils";

export function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatRoom = pathname.startsWith("/chat/");

  return (
    <div
      className={cn(
        isChatRoom
          ? "h-[100dvh] w-full overflow-hidden p-0"
          : "mx-auto min-h-screen max-w-[1680px] px-0 pb-24 pt-4 sm:px-0 lg:px-8 lg:pb-8 lg:pt-6"
      )}
    >
      <AndroidBackButtonHandler />

      <div
        className={cn(
          "flex min-w-0",
          isChatRoom ? "h-[100dvh] w-full gap-0" : "min-h-[calc(100vh-2rem)] gap-4 lg:min-h-[calc(100vh-3rem)]"
        )}
      >
        {!isChatRoom ? (
          <Suspense fallback={null}>
            <AppSidebar />
          </Suspense>
        ) : null}

        <main
          className={cn(
            "min-w-0 flex-1",
            isChatRoom
              ? "h-[100dvh] w-full overflow-hidden p-0"
              : "overflow-visible lg:overflow-hidden lg:rounded-[30px] lg:border lg:border-slate-200 lg:bg-[rgb(var(--surface))] lg:p-3 lg:shadow-soft"
          )}
        >
          <div
            className={cn(
              isChatRoom
                ? "h-[100dvh] w-full min-w-0"
                : "min-w-0 lg:h-full lg:rounded-[26px] lg:border lg:border-slate-200 lg:bg-[rgb(var(--surface-strong))] lg:p-5"
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {!isChatRoom ? (
        <Suspense fallback={null}>
          <MobileTabBar />
        </Suspense>
      ) : null}
    </div>
  );
}
