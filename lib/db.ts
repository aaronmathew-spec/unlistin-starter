// lib/db.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  // RLS on; cookie session is forwarded automatically
  const cookieStore = cookies();
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      autoRefreshToken: true,
      storage: {
        getItem: (key: string) => cookieStore.get(key)?.value ?? null,
        setItem: () => {},
        removeItem: () => {},
      } as any,
    },
  });
}
