import { redirect } from "next/navigation";
import { hasCompletedProfileSetup } from "@/lib/auth/profile";
import { getServerUserOrRedirectOnInvalidSession } from "@/lib/auth/server-session";
import { getChatRoomPreviews } from "@/lib/chats/chats";
import { getFriendCollections } from "@/lib/friends/friends";
import { getUserProfile, updateProfileLastSeen } from "@/lib/profile/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HomeTabsView } from "@/components/home/home-tabs-view";

type HomePageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

const allowedTabs = new Set(["friends", "chats", "settings"]);

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = await createSupabaseServerClient();
  const user = await getServerUserOrRedirectOnInvalidSession(supabase);

  if (!user) {
    redirect("/login");
  }

  const profileComplete = await hasCompletedProfileSetup(supabase, user);

  if (!profileComplete) {
    redirect("/profile/setup");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const currentTab = allowedTabs.has(resolvedSearchParams?.tab ?? "")
    ? (resolvedSearchParams?.tab as "friends" | "chats" | "settings")
    : "friends";

  await updateProfileLastSeen(supabase, user.id);

  const [profile, friends, chats] = await Promise.all([
    getUserProfile(supabase, user.id),
    getFriendCollections(supabase, user.id),
    getChatRoomPreviews(supabase, user.id)
  ]);

  return (
    <HomeTabsView
      initialChats={chats ?? []}
      initialFriends={friends}
      initialProfile={profile}
      initialTab={currentTab}
      userEmail={user.email ?? ""}
      userId={user.id}
    />
  );
}
