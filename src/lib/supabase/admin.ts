// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  // Fail early at boot if misconfigured in prod; in dev you may tolerate this.
  // eslint-disable-next-line no-console
  console.warn("Supabase admin client missing envs: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE");
}

export const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!, // **service role** (server only!)
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
