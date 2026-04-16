import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { anonKey, url } = getSupabasePublicEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // Server Components can read request cookies, but they cannot mutate them.
      },
      remove() {
        // Cookie writes are handled by the action-specific Supabase client below.
      }
    }
  });
}

export async function createSupabaseActionClient() {
  const cookieStore = await cookies();
  const { anonKey, url } = getSupabasePublicEnv();

  type CookieOptions = Parameters<typeof cookieStore.set>[2];

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set(name, "", { ...options, maxAge: 0 });
      }
    }
  });
}
