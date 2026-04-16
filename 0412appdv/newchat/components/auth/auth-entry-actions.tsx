"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";

function prefetchAuthRoutes(router: ReturnType<typeof useRouter>) {
  router.prefetch("/login");
  router.prefetch("/signup");
}

export function AuthEntryActions() {
  const router = useRouter();

  useEffect(() => {
    prefetchAuthRoutes(router);
  }, [router]);

  const handleWarmup = () => {
    prefetchAuthRoutes(router);
  };

  return (
    <div className="mt-7 flex w-full flex-col gap-3">
      <PrimaryButton
        href="/login"
        className="w-full"
        onPointerDown={handleWarmup}
        onPointerEnter={handleWarmup}
      >
        Login
      </PrimaryButton>
      <SecondaryButton
        href="/signup"
        className="w-full"
        onPointerDown={handleWarmup}
        onPointerEnter={handleWarmup}
      >
        Sign Up
      </SecondaryButton>
    </div>
  );
}
