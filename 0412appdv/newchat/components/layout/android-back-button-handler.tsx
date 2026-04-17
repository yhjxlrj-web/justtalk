"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import type { SupportedLocale } from "@/lib/i18n/messages";

const EXIT_CONFIRM_WINDOW_MS = 1900;
const EXIT_HINT_HIDE_MS = 1600;

const EXIT_HINT_BY_LOCALE: Record<SupportedLocale, string> = {
  ko: "\uD55C \uBC88 \uB354 \uB204\uB974\uBA74 \uC885\uB8CC\uB429\uB2C8\uB2E4.",
  en: "Press back again to exit.",
  es: "Pulsa atras otra vez para salir."
};

function isAndroidNativeRuntime() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function isVisibleElement(element: HTMLElement) {
  if (element.getClientRects().length === 0) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.pointerEvents !== "none";
}

function tryCloseActiveOverlay() {
  const explicitCloseTargets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-android-back-close="true"]')
  ).filter(isVisibleElement);

  if (explicitCloseTargets.length > 0) {
    explicitCloseTargets[explicitCloseTargets.length - 1]?.click();
    return true;
  }

  const hasOpenDialog = Array.from(
    document.querySelectorAll<HTMLElement>('[aria-modal="true"], [role="dialog"]')
  ).some(isVisibleElement);

  if (hasOpenDialog) {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true
      })
    );
    return true;
  }

  return false;
}

function tryDismissFocusedInput() {
  const activeElement = document.activeElement as HTMLElement | null;

  if (!activeElement) {
    return false;
  }

  const tagName = activeElement.tagName;
  const isEditable =
    tagName === "INPUT" || tagName === "TEXTAREA" || activeElement.isContentEditable;

  if (!isEditable) {
    return false;
  }

  activeElement.blur();
  return true;
}

function resolveFallbackRoute(pathname: string) {
  if (pathname.startsWith("/chat/") || pathname === "/chat") {
    return "/home?tab=chats";
  }

  if (pathname.startsWith("/profile/setup") || pathname.startsWith("/setup-profile")) {
    return "/login";
  }

  return "/home";
}

export function AndroidBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useCurrentLocale();
  const lastBackPressedAtRef = useRef(0);
  const hideExitHintTimerRef = useRef<number | null>(null);
  const routeHistoryRef = useRef<string[]>([]);
  const latestPathnameRef = useRef(normalizePath(pathname));
  const latestLocaleRef = useRef(locale);
  const [showExitHint, setShowExitHint] = useState(false);

  useEffect(() => {
    latestPathnameRef.current = normalizePath(pathname);

    const history = routeHistoryRef.current;
    if (history[history.length - 1] !== latestPathnameRef.current) {
      history.push(latestPathnameRef.current);
    }

    if (history.length > 32) {
      history.splice(0, history.length - 32);
    }
  }, [pathname]);

  useEffect(() => {
    latestLocaleRef.current = locale;
  }, [locale]);

  useEffect(() => {
    if (!isAndroidNativeRuntime()) {
      return;
    }

    let isDisposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const registerListener = async () => {
      listenerHandle = await CapacitorApp.addListener("backButton", () => {
        if (tryCloseActiveOverlay()) {
          return;
        }

        if (tryDismissFocusedInput()) {
          return;
        }

        const normalizedPath = latestPathnameRef.current;
        const isHomeRoot = normalizedPath === "/home";
        const hasRouteHistory = routeHistoryRef.current.length > 1 || window.history.length > 1;

        if (normalizedPath.startsWith("/chat/") || normalizedPath === "/chat") {
          router.replace("/home?tab=chats");
          return;
        }

        if (!isHomeRoot) {
          if (hasRouteHistory) {
            routeHistoryRef.current.pop();
            router.back();
            return;
          }

          router.replace(resolveFallbackRoute(normalizedPath));
          return;
        }

        const now = Date.now();
        if (now - lastBackPressedAtRef.current <= EXIT_CONFIRM_WINDOW_MS) {
          void CapacitorApp.exitApp();
          return;
        }

        lastBackPressedAtRef.current = now;
        setShowExitHint(true);

        if (hideExitHintTimerRef.current !== null) {
          window.clearTimeout(hideExitHintTimerRef.current);
        }

        hideExitHintTimerRef.current = window.setTimeout(() => {
          setShowExitHint(false);
          hideExitHintTimerRef.current = null;
        }, EXIT_HINT_HIDE_MS);
      });

      if (isDisposed && listenerHandle) {
        await listenerHandle.remove();
      }
    };

    void registerListener();

    return () => {
      isDisposed = true;

      if (hideExitHintTimerRef.current !== null) {
        window.clearTimeout(hideExitHintTimerRef.current);
        hideExitHintTimerRef.current = null;
      }

      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [router]);

  if (!showExitHint || !isAndroidNativeRuntime()) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[210] -translate-x-1/2 rounded-full bg-slate-900/92 px-4 py-2 text-xs font-medium text-white shadow-lg">
      {EXIT_HINT_BY_LOCALE[latestLocaleRef.current]}
    </div>
  );
}
