// app/auth/callback/page.tsx
'use client';

export const dynamic = 'force-dynamic'; // disable prerendering/SSG for this page

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      const code = params.get('code');
      const next = params.get('next') || '/requests';

      if (!code) {
        // No code => bounce home
        router.replace('/');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('Auth exchange error:', error);
        alert('Sign-in failed. Try again.');
        router.replace('/');
        return;
      }

      router.replace(next);
    })();
  }, [params, router]);

  return <p style={{ padding: 24 }}>Signing you in…</p>;
}
