// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a single client for the browser
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // If you’re using email magic links, you usually don’t want local storage
    // in server components; this is safe for the client-only usage in AuthForm.
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
