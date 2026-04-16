import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/auth-screen";
import { getPostLoginRedirectPath } from "@/lib/auth/profile";
import { getServerUserOrRedirectOnInvalidSession } from "@/lib/auth/server-session";
import { getServerAuthLocale } from "@/lib/i18n/auth-locale-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignupPage({
  searchParams
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const user = await getServerUserOrRedirectOnInvalidSession(supabase);

  if (user) {
    redirect(await getPostLoginRedirectPath(supabase, user));
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialLocale = await getServerAuthLocale(resolvedSearchParams?.lang);

  return <AuthScreen initialLocale={initialLocale} mode="signup" />;
}
