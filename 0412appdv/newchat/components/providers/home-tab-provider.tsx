"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type HomeTab = "friends" | "chats" | "settings";

const allowedHomeTabs = new Set<HomeTab>(["friends", "chats", "settings"]);

function resolveHomeTab(tab: string | null | undefined): HomeTab {
  return tab && allowedHomeTabs.has(tab as HomeTab) ? (tab as HomeTab) : "friends";
}

const HomeTabContext = createContext<{
  activeTab: HomeTab;
  isHomeRoute: boolean;
  setActiveTab: (tab: HomeTab) => void;
} | null>(null);

export function HomeTabProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHomeRoute = pathname.startsWith("/home");
  const [activeTab, setActiveTabState] = useState<HomeTab>(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/home")) {
      return resolveHomeTab(new URLSearchParams(window.location.search).get("tab"));
    }

    return resolveHomeTab(searchParams.get("tab"));
  });

  useEffect(() => {
    if (!isHomeRoute) {
      return;
    }

    setActiveTabState(resolveHomeTab(searchParams.get("tab")));
  }, [isHomeRoute, searchParams]);

  useEffect(() => {
    const handlePopState = () => {
      if (!window.location.pathname.startsWith("/home")) {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      setActiveTabState(resolveHomeTab(params.get("tab")));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const setActiveTab = useCallback(
    (nextTab: HomeTab) => {
      setActiveTabState(nextTab);

      if (!pathname.startsWith("/home")) {
        return;
      }

      window.history.replaceState(window.history.state, "", `/home?tab=${nextTab}`);
    },
    [pathname]
  );

  const value = useMemo(
    () => ({
      activeTab,
      isHomeRoute,
      setActiveTab
    }),
    [activeTab, isHomeRoute, setActiveTab]
  );

  return <HomeTabContext.Provider value={value}>{children}</HomeTabContext.Provider>;
}

export function useHomeTabs() {
  const context = useContext(HomeTabContext);

  if (!context) {
    throw new Error("useHomeTabs must be used within a HomeTabProvider.");
  }

  return context;
}
