'use client';
import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthForm() {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/dashboard` },
      });
      if (error) throw error;
      setStatus('Check your email for a login link.');
    } catch (err: any) {
      setStatus(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
      <label>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
      </label>
      <button type="submit" disabled={loading} style={{ padding: '10px 14px', borderRadius: 8, border: 0 }}>
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
      {status && <p style={{ fontSize: 14 }}>{status}</p>}
    </form>
  );
}
