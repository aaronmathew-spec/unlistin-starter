'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/requests`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: 16 }}>
      <h1>Sign in</h1>
      {sent ? (
        <p>Check your email for a magic link. After clicking it, you’ll land on Requests.</p>
      ) : (
        <form onSubmit={sendLink} style={{ display: 'grid', gap: 12 }}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </label>
          <button disabled={loading} type="submit" style={{ padding: '8px 12px' }}>
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
          {err && <p style={{ color: 'crimson' }}>{err}</p>}
        </form>
      )}
    </div>
  );
}
