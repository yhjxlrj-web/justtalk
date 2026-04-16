"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { DictionaryProvider } from "@/components/providers/dictionary-provider";
import {
  AUTH_LOCALE_COOKIE,
  AUTH_LOCALE_STORAGE_KEY,
  resolveAuthLocale
} from "@/lib/i18n/auth-locale";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { SupportedLocale } from "@/lib/i18n/messages";

const localeOptions: Array<{ value: SupportedLocale; label: string }> = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" }
];

function persistAuthLocale(locale: SupportedLocale) {
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_LOCALE_STORAGE_KEY, locale);
  }
}

export function AuthScreen({
  initialLocale,
  mode,
  verificationSent = false
}: {
  initialLocale: SupportedLocale;
  mode: "login" | "signup";
  verificationSent?: boolean;
}) {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedLocale = window.localStorage.getItem(AUTH_LOCALE_STORAGE_KEY);

    if (!storedLocale) {
      return;
    }

    const resolvedLocale = resolveAuthLocale(storedLocale);

    if (resolvedLocale !== initialLocale) {
      setLocale(resolvedLocale);
      persistAuthLocale(resolvedLocale);
    }
  }, [initialLocale]);

  useEffect(() => {
    persistAuthLocale(locale);
    router.prefetch(`/login?lang=${locale}`);
    router.prefetch(`/signup?lang=${locale}`);
  }, [locale, router]);

  const dictionary = useMemo(() => getDictionary(locale), [locale]);
  const auth = useMemo(() => getAuthMessages(locale), [locale]);
  const footerLink = mode === "login" ? `/signup?lang=${locale}` : `/login?lang=${locale}`;

  return (
    <DictionaryProvider dictionary={dictionary} locale={locale}>
      <main className="flex min-h-screen items-center justify-center px-2.5 py-6 sm:px-4 sm:py-8">
        <AuthCard
          brandName={auth.appTitle}
          brandTagline={auth.tagline}
          headerSlot={
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {auth.localeSectionLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {localeOptions.map((option) => {
                  const active = locale === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLocale(option.value)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-sm transition",
                        active
                          ? "border-brand-300 bg-brand-50 text-brand-700 shadow-soft"
                          : "border-slate-200 bg-white text-slate-600 shadow-soft hover:bg-slate-50"
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          }
          eyebrow={mode === "login" ? auth.welcomeBack : auth.createSpace}
          title={mode === "login" ? auth.loginTitle : auth.signupTitle}
          description={auth.authDescription}
          footerText={mode === "login" ? auth.needAccount : auth.alreadyHaveAccount}
          footerLink={footerLink}
          footerLabel={mode === "login" ? auth.createOne : auth.logIn}
          panelTitle={auth.marketingTitle}
          panelDescription={auth.marketingDescription}
          panelNoteLabel={auth.starterNotes}
          panelNoteBody={auth.starterNotesDescription}
        >
          {mode === "login" ? <LoginForm verificationSent={verificationSent} /> : <SignupForm />}
        </AuthCard>
      </main>
    </DictionaryProvider>
  );
}
