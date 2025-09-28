'use client';

import { useRef, useState } from 'react';

export default function LeadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const city_state = String(form.get('city_state') ?? '').trim();

    try {
      if (!name) throw new Error('Please enter your name.');
      if (!email) throw new Error('Please enter a valid email.');

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, city_state, source: 'site' }),
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to submit.');

      setMessage('Thanks! We’ll scan and send updates shortly.');
      // Only reset if the ref is there
      if (formRef.current) formRef.current.reset();
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-8 space-y-4 max-w-2xl">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Name</label>
        <input
          name="name"
          type="text"
          placeholder="Jane Doe"
          className="w-full rounded border px-3 py-2"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          placeholder="jane@example.com"
          className="w-full rounded border px-3 py-2"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">City, State</label>
        <input
          name="city_state"
          type="text"
          placeholder="Mumbai, MH"
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Get scan & updates'}
      </button>

      {message && (
        <p className="text-sm text-gray-700">
          {message}
        </p>
      )}
    </form>
  );
}
