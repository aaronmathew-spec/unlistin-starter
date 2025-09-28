'use client';

import { useState } from 'react';
import supabase from '@/lib/supabaseClient';

export default function LoginMagic({ next = '/requests' }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) return <p>Check your email for a sign-in link.</p>;

  return (
    <form onSubmit={sendLink} style={{ display:'grid', gap:12, maxWidth:400 }}>
      <h3>Sign in with a magic link</h3>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        style={{ padding:10 }}
      />
      <button type="submit" style={{ padding:'10px 14px' }}>Send magic link</button>
      {error && <p style={{ color:'crimson' }}>{error}</p>}
    </form>
  );
}
