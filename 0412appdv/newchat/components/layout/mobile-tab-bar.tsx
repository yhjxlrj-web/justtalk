"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDictionary } from "@/components/providers/dictionary-provider";
import { useHomeTabs, type HomeTab } from "@/components/providers/home-tab-provider";
import { getNavigationItems } from "@/lib/config/navigation";
import { cn } from "@/lib/utils";

export function MobileTabBar() {
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
    height: 46,
    opacity: 0,
    width: 46,
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
    <nav className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] right-3 z-20 lg:hidden">
      <div className="relative flex h-[62px] w-[195px] items-center justify-between rounded-[20px] border border-slate-200 bg-[rgb(var(--surface-strong))] px-2.5 py-1.5 shadow-md">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-[14px] bg-brand-500 shadow-sm transition-transform duration-220 ease-out"
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
                  "relative z-10 flex items-center justify-center transition",
                  active
                    ? "h-[46px] w-[46px] rounded-[14px] text-pink-500"
                    : "h-[42px] w-[42px] rounded-[12px] text-brand-700 hover:bg-gray-100"
                )}
              >
                <MobileTabIcon icon={item.icon} active={active} />
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
                "relative z-10 flex items-center justify-center transition",
                active
                  ? "h-[46px] w-[46px] rounded-[14px] text-pink-500"
                  : "h-[42px] w-[42px] rounded-[12px] text-brand-700 hover:bg-gray-100"
              )}
            >
              <MobileTabIcon icon={item.icon} active={active} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileTabIcon({ active, icon }: { active: boolean; icon: string }) {
  const common = active ? "stroke-pink-500" : "stroke-brand-700";

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
