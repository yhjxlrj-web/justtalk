import { resolveLocale } from "@/lib/i18n/get-dictionary";
import type { SupportedLocale } from "@/lib/i18n/messages";

export const AUTH_LOCALE_COOKIE = "talkbridge-auth-locale";
export const AUTH_LOCALE_STORAGE_KEY = "talkbridge-auth-locale";

export function resolveAuthLocale(value?: string | null): SupportedLocale {
  return resolveLocale(value);
}
