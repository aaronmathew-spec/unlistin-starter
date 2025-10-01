// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export function getServerSupabase() {
  const store = cookies();

  // Use anon key so RLS + auth.uid() work inside SQL/RPC
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        // In route handlers, mutating cookies is usually not needed for our reads.
        // Make these no-ops to avoid "not implemented" errors in edge/node runtimes.
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  );
}
