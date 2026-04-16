"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDictionary } from "@/components/providers/dictionary-provider";
import { GlassCard } from "@/components/ui/glass-card";
import { getNavigationItems } from "@/lib/config/navigation";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "friends";
  const dictionary = useDictionary();
  const navigationItems = getNavigationItems(dictionary);

  return (
    <aside className="hidden w-[88px] shrink-0 lg:block">
      <GlassCard className="flex h-full flex-col items-center px-2 py-3">
        <Link
          href="/home?tab=friends"
          aria-label="JustTalk Home"
          className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-brand-500 text-[15px] font-bold text-white shadow-float"
        >
          T
        </Link>

        <div className="mt-4 flex flex-col items-center gap-3">
          {navigationItems.map((item) => {
            const itemTab = new URLSearchParams(item.href.split("?")[1] ?? "").get("tab");
            const active =
              pathname.startsWith("/home") && itemTab ? currentTab === itemTab : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition",
                  active
                    ? "bg-brand-500 text-white shadow-float"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <SidebarIcon icon={item.icon} active={active} />
                <span
                  className={cn(
                    "text-[11px] font-medium leading-none",
                    active ? "text-white" : "text-slate-600"
                  )}
                >
                  {item.label}
                </span>
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
