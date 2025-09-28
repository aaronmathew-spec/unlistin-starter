'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['data_broker', 'social_profile', 'search_result', 'other'] as const;

export default function NewRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const category = String(form.get('category') ?? '').trim();
    const removal_url = String(form.get('removal_url') ?? '').trim();
    const notes = String(form.get('notes') ?? '').trim();

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, removal_url, notes }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || 'Failed to submit.');

      // go back to the list you already have
      router.push('/requests');
    } catch (err: any) {
      setMsg(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ margin: 0 }}>New Request</h1>
      <p style={{ color: '#666' }}>Submit a link to remove and any notes.</p>

      <form onSubmit={onSubmit} style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Category</span>
          <select name="category" defaultValue="other" style={{ padding: 8 }}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Profile / Link to remove</span>
          <input name="removal_url" type="url" placeholder="https://example.com/profile/123" style={{ padding: 8 }} />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Notes</span>
          <textarea name="notes" rows={4} placeholder="Any extra context…" style={{ padding: 8 }} />
        </label>

        <button
          type="submit"
          disabled={submitting}
          style={{ padding: '10px 14px', background: '#000', color: '#fff', borderRadius: 6 }}
        >
          {submitting ? 'Submitting…' : 'Queue Request'}
        </button>

        {msg && <p style={{ color: '#444' }}>{msg}</p>}
      </form>
    </main>
  );
}
