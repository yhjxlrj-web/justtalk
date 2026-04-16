import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

const INVALID_REFRESH_TOKEN_PATTERNS = [
  "invalid refresh token",
  "refresh token not found",
  "refresh_token_not_found",
  "jwt expired",
  "session_not_found"
];

export function hasInvalidServerSession(message?: string | null) {
  const normalized = message?.toLowerCase().trim();

  if (!normalized) {
    return false;
  }

  return INVALID_REFRESH_TOKEN_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export async function getServerUserOrRedirectOnInvalidSession(supabase: {
  auth: {
    getUser: () => Promise<{
      data?: { user?: User | null } | null;
      error?: { message?: string | null } | null;
    }>;
  };
}) {
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user && hasInvalidServerSession(authResponse.error?.message)) {
    redirect("/auth/session-expired");
  }

  return user;
}
