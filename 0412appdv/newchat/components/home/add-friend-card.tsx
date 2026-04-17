"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { PrimaryButton } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { initialCreateFriendRequestFormState } from "@/lib/friends/action-state";
import { createFriendRequestAction } from "@/lib/friends/actions";
import { getUiCopy } from "@/lib/i18n/ui-copy";

export function AddFriendCard() {
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createFriendRequestAction,
    initialCreateFriendRequestFormState
  );
  const errors = state?.errors ?? {};

  useEffect(() => {
    if (!state?.successMessage) {
      return;
    }

    formRef.current?.reset();
    setIsOpen(false);
    router.refresh();
  }, [router, state?.successMessage]);

  return (
    <GlassCard className="rounded-[16px] border border-slate-200 bg-[rgb(var(--surface-strong))] p-3.5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-ink sm:text-sm">{dictionary.addFriend}</p>
          {copy.addFriend.description ? (
            <p className="mt-1.5 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
              {copy.addFriend.description}
            </p>
          ) : null}
        </div>

        <PrimaryButton
          type="button"
          className="w-full sm:w-auto"
          onClick={() => setIsOpen((value) => !value)}
        >
          {isOpen ? dictionary.close : dictionary.addFriend}
        </PrimaryButton>
      </div>

      {state?.successMessage ? (
        <div className="mt-3.5 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-700 shadow-soft sm:text-sm">
          {state.successMessage}
        </div>
      ) : null}

      {isOpen ? (
        <form ref={formRef} action={formAction} className="mt-3.5 space-y-3.5">
          <Input
            id="friend-email"
            name="email"
            type="email"
            label={dictionary.friendEmail}
            placeholder={copy.addFriend.emailPlaceholder}
            autoComplete="email"
            error={errors.email ?? ""}
          />

          {errors.form ? (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] text-rose-600 shadow-soft sm:text-sm">
              {errors.form}
            </div>
          ) : (
            <div className="rounded-[14px] border border-slate-200 bg-white px-3.5 py-2.5 text-[12px] leading-5 text-slate-500 shadow-soft sm:text-sm sm:leading-6">
              {copy.addFriend.helper}
            </div>
          )}

          <div className="flex">
            <PrimaryButton type="submit" className="sm:w-auto" disabled={isPending}>
              {isPending ? dictionary.sending : dictionary.sendRequest}
            </PrimaryButton>
          </div>
        </form>
      ) : null}
    </GlassCard>
  );
}
