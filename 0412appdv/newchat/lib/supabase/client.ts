import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const { anonKey, url } = getSupabasePublicEnv();

  return createBrowserClient(url, anonKey);
}
