'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/requests';
  const [msg, setMsg] = useState('Completing sign in…');

  useEffect(() => {
    // Supabase will auto-hydrate session from the URL hash on page load.
    // Give it a moment, then check session and redirect.
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setMsg('Signed in. Redirecting…');
          router.replace(next);
        } else {
          // If the hash hasn't been processed yet, wait briefly and retry once.
          setTimeout(async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) router.replace(next);
            else setMsg('Could not complete sign in. Please request a new link.');
          }, 800);
        }
      } catch {
        setMsg('Could not complete sign in. Please request a new link.');
      }
    })();
  }, [router, next]);

  return <p>{msg}</p>;
}
