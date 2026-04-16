import { redirect } from "next/navigation";
import { getPostLoginRedirectPath, hasCompletedProfileSetup } from "@/lib/auth/profile";
import { getServerUserOrRedirectOnInvalidSession } from "@/lib/auth/server-session";
import { getServerAuthLocale } from "@/lib/i18n/auth-locale-server";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { getUserProfile } from "@/lib/profile/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileSetupForm } from "@/components/profile/profile-setup-form";
import { GlassCard } from "@/components/ui/glass-card";

export default async function ProfileSetupPage() {
  const supabase = await createSupabaseServerClient();
  const user = await getServerUserOrRedirectOnInvalidSession(supabase);

  if (!user) {
    redirect("/login");
  }

  const profileComplete = await hasCompletedProfileSetup(supabase, user);

  if (profileComplete) {
    redirect(await getPostLoginRedirectPath(supabase, user));
  }

  const profile = await getUserProfile(supabase, user.id);
  const authLocale = await getServerAuthLocale();
  const locale = profile?.preferredLanguage === "ko" || profile?.preferredLanguage === "es"
    ? profile.preferredLanguage
    : authLocale;
  const auth = getAuthMessages(locale);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <GlassCard className="p-6 sm:p-7">
        <p className="text-xs uppercase tracking-[0.32em] text-brand-700/80">{auth.setupEyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{auth.setupTitle}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{auth.setupDescription}</p>
      </GlassCard>

      <ProfileSetupForm profile={profile} />
    </div>
  );
}
