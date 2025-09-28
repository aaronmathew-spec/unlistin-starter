'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Stop Next from trying to prerender this page.
export const dynamic = 'force-dynamic'; // or: export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = search.get('code'); // Supabase redirects with ?code=...
      if (!code) {
        // No code, go back to login (or home)
        router.replace('/login');
        return;
      }

      try {
        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        // Signed in — send them where you want (requests page, etc.)
        router.replace('/requests');
      } catch {
        router.replace('/login?error=callback');
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  return <p style={{ padding: 24 }}>Finishing sign-in…</p>;
}
