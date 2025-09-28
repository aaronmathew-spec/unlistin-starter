'use client';

import React, { useState } from 'react';
import supabase from '../lib/supabaseClient';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);

    try {
      // Compute a redirect back into your app after clicking the magic link
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || '';
      const emailRedirectTo = `${origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });

      if (error) throw error;
      setMsg('Check your email for the magic link.');
    } catch (e: any) {
      setErr(e?.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <label>
        <div>Email</div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          style={{ width: '100%', padding: 8 }}
        />
      </label>

      <button type="submit" disabled={busy} style={{ padding: '10px 14px' }}>
        {busy ? 'Sending…' : 'Send magic link'}
      </button>

      {msg && <p style={{ color: '#165' }}>{msg}</p>}
      {err && <p style={{ color: '#b00' }}>{err}</p>}
    </form>
  );
}
