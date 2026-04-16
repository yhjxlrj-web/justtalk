"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDictionary } from "@/components/providers/dictionary-provider";
import { useHomeTabs, type HomeTab } from "@/components/providers/home-tab-provider";
import { GlassCard } from "@/components/ui/glass-card";
import { getNavigationItems } from "@/lib/config/navigation";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const dictionary = useDictionary();
  const { activeTab: currentTab, isHomeRoute, setActiveTab } = useHomeTabs();
  const navigationItems = getNavigationItems(dictionary);
  const itemRefs = useRef<Array<HTMLButtonElement | HTMLAnchorElement | null>>([]);
  const [highlightStyle, setHighlightStyle] = useState<{
    height: number;
    opacity: number;
    width: number;
    x: number;
    y: number;
  }>({
    height: 40,
    opacity: 0,
    width: 40,
    x: 0,
    y: 0
  });
  const activeIndex = useMemo(
    () =>
      navigationItems.findIndex((item) => {
        const itemTab = new URLSearchParams(item.href.split("?")[1] ?? "").get("tab");
        return pathname.startsWith("/home") && itemTab ? currentTab === itemTab : pathname === item.href;
      }),
    [currentTab, navigationItems, pathname]
  );

  useEffect(() => {
    const activeElement = itemRefs.current[activeIndex];

    if (!activeElement) {
      return;
    }

    setHighlightStyle({
      height: activeElement.offsetHeight,
      opacity: 1,
      width: activeElement.offsetWidth,
      x: activeElement.offsetLeft,
      y: activeElement.offsetTop
    });
  }, [activeIndex]);

  return (
    <aside className="hidden w-[64px] shrink-0 lg:block">
      <GlassCard className="app-sidebar-shell flex h-full flex-col items-center px-2 py-3">
        <Link
          href="/home?tab=friends"
          aria-label="JustTalk Home"
          className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-brand-500 text-[15px] font-bold text-white shadow-float"
        >
          T
        </Link>

        <div className="relative mt-4 flex flex-col items-center gap-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 rounded-lg bg-brand-500 shadow-float transition-[transform,opacity] duration-220 ease-out"
            style={{
              height: `${highlightStyle.height}px`,
              opacity: highlightStyle.opacity,
              transform: `translate(${highlightStyle.x}px, ${highlightStyle.y}px)`,
              width: `${highlightStyle.width}px`
            }}
          />
          {navigationItems.map((item) => {
            const itemTab = new URLSearchParams(item.href.split("?")[1] ?? "").get("tab");
            const active =
              pathname.startsWith("/home") && itemTab ? currentTab === itemTab : pathname === item.href;

            if (isHomeRoute && itemTab) {
              return (
                <button
                  key={item.href}
                  ref={(element) => {
                    itemRefs.current[navigationItems.indexOf(item)] = element;
                  }}
                  type="button"
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => setActiveTab(itemTab as HomeTab)}
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-lg p-2 transition",
                    active
                      ? "text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <SidebarIcon icon={item.icon} active={active} />
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                ref={(element) => {
                  itemRefs.current[navigationItems.indexOf(item)] = element;
                }}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-lg p-2 transition",
                  active
                    ? "text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <SidebarIcon icon={item.icon} active={active} />
              </Link>
            );
          })}
        </div>
      </GlassCard>
    </aside>
  );
}

function SidebarIcon({ active, icon }: { active: boolean; icon: string }) {
  const common = active ? "stroke-white" : "stroke-brand-700";

  if (icon === "friends") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" strokeWidth="1.9">
        <circle className={common} cx="9" cy="8" r="3.25" />
        <circle className={common} cx="16.5" cy="9.5" r="2.5" />
        <path className={common} d="M4 19c1.4-2.7 3.5-4 6.2-4 2.4 0 4.4 1 5.8 3" />
        <path className={common} d="M14.5 18c.7-1.5 1.9-2.4 3.6-2.8" />
      </svg>
    );
  }

  if (icon === "chat") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" strokeWidth="1.9">
        <path className={common} d="M4 5h16v10H8l-4 4V5Z" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" strokeWidth="1.9">
      <path className={common} d="M12 3v3" />
      <path className={common} d="M12 18v3" />
      <path className={common} d="M4.9 4.9l2.1 2.1" />
      <path className={common} d="M17 17l2.1 2.1" />
      <path className={common} d="M3 12h3" />
      <path className={common} d="M18 12h3" />
      <path className={common} d="M4.9 19.1L7 17" />
      <path className={common} d="M17 7l2.1-2.1" />
      <circle className={common} cx="12" cy="12" r="3.5" />
    </svg>
  );
}
