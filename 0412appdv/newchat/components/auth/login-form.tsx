"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthStatusNotice } from "@/components/auth/auth-status-notice";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import { initialLoginFormState } from "@/lib/auth/action-state";
import { loginAction } from "@/lib/auth/actions";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/ui/button";

export function LoginForm({ verificationSent = false }: { verificationSent?: boolean }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialLoginFormState);
  const router = useRouter();
  const locale = useCurrentLocale();
  const auth = getAuthMessages(locale);
  const errors = state?.errors ?? {};
  const redirectTo = state?.redirectTo;

  useEffect(() => {
    router.prefetch(`/login?lang=${locale}`);
    router.prefetch(`/signup?lang=${locale}`);
    router.prefetch("/home?tab=friends");
    router.prefetch("/home?tab=chats");
    router.prefetch("/home?tab=settings");
  }, [locale, router]);

  useEffect(() => {
    if (!redirectTo) {
      return;
    }

    router.prefetch(redirectTo);

    if (redirectTo.startsWith("/home")) {
      router.prefetch("/home?tab=friends");
      router.prefetch("/home?tab=chats");
      router.prefetch("/home?tab=settings");
    }

    router.replace(redirectTo);
  }, [redirectTo, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Input
        id="email"
        name="email"
        label={auth.emailAddress}
        type="email"
        placeholder={auth.emailPlaceholder}
        autoComplete="email"
        error={errors.email ?? ""}
      />
      <Input
        id="password"
        name="password"
        label={auth.password}
        type="password"
        placeholder={auth.loginPasswordPlaceholder}
        autoComplete="current-password"
        error={errors.password ?? ""}
      />

      {errors.form ? (
        <AuthStatusNotice message={errors.form} tone="error" />
      ) : verificationSent ? (
        <AuthStatusNotice message={auth.signupVerificationSent} tone="success" />
      ) : auth.loginInfo ? (
        <AuthStatusNotice message={auth.loginInfo} />
      ) : null}

      <div className="flex flex-col gap-3 pt-2">
        <PrimaryButton type="submit" className="w-full" disabled={isPending}>
          {isPending ? auth.loginSubmitting : auth.loginCta}
        </PrimaryButton>
      </div>
    </form>
  );
}
