import { cookies } from "next/headers";
import { AUTH_LOCALE_COOKIE, resolveAuthLocale } from "@/lib/i18n/auth-locale";
import type { SupportedLocale } from "@/lib/i18n/messages";

export async function getServerAuthLocale(searchLocale?: string | null): Promise<SupportedLocale> {
  if (searchLocale) {
    return resolveAuthLocale(searchLocale);
  }

  const cookieStore = await cookies();
  return resolveAuthLocale(cookieStore.get(AUTH_LOCALE_COOKIE)?.value);
}

export async function setServerAuthLocale(locale: string) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_LOCALE_COOKIE, resolveAuthLocale(locale), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30
  });
}
