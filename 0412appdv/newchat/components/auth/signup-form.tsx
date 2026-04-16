"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthStatusNotice } from "@/components/auth/auth-status-notice";
import { useCurrentLocale } from "@/components/providers/dictionary-provider";
import { initialSignupFormState } from "@/lib/auth/action-state";
import { signupAction } from "@/lib/auth/actions";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/ui/button";

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialSignupFormState);
  const router = useRouter();
  const locale = useCurrentLocale();
  const auth = getAuthMessages(locale);
  const errors = state?.errors ?? {};
  const status = state?.status;

  useEffect(() => {
    router.prefetch(`/login?lang=${locale}`);
    router.prefetch(`/signup?lang=${locale}`);
  }, [locale, router]);

  useEffect(() => {
    if (!status || status.kind !== "success") {
      return;
    }

    router.replace(`/login?lang=${locale}&verification=sent`);
  }, [locale, router, status]);

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
        placeholder={auth.signupPasswordPlaceholder}
        autoComplete="new-password"
        hint={auth.passwordHint}
        error={errors.password ?? ""}
      />

      {errors.form ? (
        <AuthStatusNotice message={errors.form} tone="error" />
      ) : null}

      {!status && !errors.form ? (
        <AuthStatusNotice message={auth.signupInfo} />
      ) : null}

      <div className="space-y-3 pt-2">
        <PrimaryButton type="submit" className="w-full" disabled={isPending}>
          {isPending ? auth.signupSubmitting : auth.signupCta}
        </PrimaryButton>
      </div>
    </form>
  );
}
