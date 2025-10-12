import { createClient } from "@supabase/supabase-js";

/**
 * Browser-safe Supabase client for client components/pages that need it.
 * Server-side code should continue using your existing server helpers.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

export default supabase;
