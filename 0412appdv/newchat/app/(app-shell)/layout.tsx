import { getDictionary, resolveLocale } from "@/lib/i18n/get-dictionary";
import { getServerAuthLocale } from "@/lib/i18n/auth-locale-server";
import { getServerUserOrRedirectOnInvalidSession } from "@/lib/auth/server-session";
import { getUserProfile } from "@/lib/profile/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppShellLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const user = await getServerUserOrRedirectOnInvalidSession(supabase);
  const profile = user ? await getUserProfile(supabase, user.id) : null;
  const authLocale = await getServerAuthLocale();
  const effectiveLocale = resolveLocale(
    profile?.preferredLanguage ?? user?.user_metadata?.preferred_language ?? authLocale
  );
  const dictionary = getDictionary(effectiveLocale);

  return (
    <AppShell dictionary={dictionary} locale={effectiveLocale}>
      {children}
    </AppShell>
  );
}
