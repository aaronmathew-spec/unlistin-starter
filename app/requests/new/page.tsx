'use client';

import { useEffect, useState, FormEvent } from 'react';
import supabase from '../../../lib/supabaseClient';

// ---- helpers ---------------------------------------------------------------

// Turn a URL or string into a nice, per-user slug (usually the domain).
function toDomain(input: string): string {
  try {
    // If user pasted a full URL
    const u = new URL(input.includes('://') ? input : `https://${input}`);
    return u.hostname.toLowerCase();
  } catch {
    // Fallback: basic cleanup
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .replace(/[^\w.-]+/g, '-');
  }
}

// ---- UI -------------------------------------------------------------------

const CATEGORIES = [
  'Data Broker',
  'Search Engine',
  'People Finder',
  'Aggregator',
  'Forum',
  'Other',
] as const;

export default function NewRequestPage() {
  const [siteUrl, setSiteUrl] = useState('');
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Require login
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/';
        return;
      }
      setAuthReady(true);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    const cleanUrl = siteUrl.trim();
    if (!cleanUrl) {
      alert('Please enter a site URL.');
      return;
    }

    setLoading(true);

    // Confirm current user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      setLoading(false);
      alert('Please sign in again.');
      return;
    }

    // 1) Upsert/ensure a target for THIS user
    const slug = toDomain(cleanUrl);

    const { data: target, error: targErr } = await supabase
      .from('targets')
      .upsert(
        { slug, url: cleanUrl }, // user_id is set by your BEFORE INSERT trigger
        { onConflict: 'user_id,slug', ignoreDuplicates: false },
      )
      .select('id')
      .single();

    if (targErr || !target) {
      setLoading(false);
      alert(`Error saving target: ${targErr?.message ?? 'unknown error'}`);
      return;
    }

    // 2) Create the request (let DB default fill "type")
    const { error: reqErr } = await supabase.from('requests').insert({
      user_id: user.id,
      target_id: target.id,
      category: category || null,
      notes: notes || null,
      // DO NOT send "type" here — DB default handles it
    });

    setLoading(false);

    if (reqErr) {
      alert(`Error creating request: ${reqErr.message}`);
      return;
    }

    // Done — take them to the list (or you can route to /requests/[id]/edit)
    window.location.href = '/requests';
  }

  if (!authReady) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">UnlistIN</h1>
        <p className="mt-4 text-gray-600">Checking your session…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">UnlistIN</h1>
        <nav className="space-x-4 text-sm">
          <a href="/" className="text-indigo-600 hover:underline">
            Home
          </a>
          <a href="/requests" className="text-indigo-600 hover:underline">
            Requests
          </a>
        </nav>
      </header>

      <h2 className="mb-4 text-xl font-medium">New Removal Request</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Site URL *</label>
          <input
            type="url"
            placeholder="https://example.com/profile/123"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            required
            className="w-full rounded border px-3 py-2 outline-none ring-indigo-500 focus:ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring"
          >
            <option value="">— Select —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            placeholder="Anything specific to track for this takedown"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            className="w-full resize-y rounded border px-3 py-2 outline-none ring-indigo-500 focus:ring"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Create Request'}
        </button>
      </form>
    </main>
  );
}
