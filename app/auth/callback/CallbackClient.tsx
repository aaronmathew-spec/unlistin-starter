'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CallbackClient() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      router.replace('/login');
      return;
    }

    (async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        router.replace('/requests'); // where to land after sign-in
      } catch {
        router.replace('/login?error=callback');
      }
    })();
  }, [params, router]);

  return <p style={{ padding: 24 }}>Finishing sign-in…</p>;
}
