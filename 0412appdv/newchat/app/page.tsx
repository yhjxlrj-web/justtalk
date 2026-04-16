import { redirect } from "next/navigation";
import { getServerAuthLocale } from "@/lib/i18n/auth-locale-server";

export default async function LandingPage() {
  const locale = await getServerAuthLocale();
  redirect(`/login?lang=${locale}`);
}
