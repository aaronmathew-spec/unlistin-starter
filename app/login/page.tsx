'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // IMPORTANT: this must match the route we created above
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setMsg('Magic link sent! Check your email.');
    } catch (err: any) {
      setMsg(err.message || 'Failed to send magic link.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '60px auto', padding: 16 }}>
      <h1>Sign in</h1>
      <form onSubmit={sendLink} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, fontSize: 16 }}
        />
        <button disabled={sending} style={{ padding: '10px 14px' }}>
          {sending ? 'Sending…' : 'Send magic link'}
        </button>
        {msg && <p>{msg}</p>}
      </form>
    </main>
  );
}
