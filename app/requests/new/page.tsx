'use client';

import { useEffect, useState } from 'react';
// NOTE: this path is correct for: app/requests/new/page.tsx  ->  lib/supabaseClient.ts
// If your project uses an alias like "@/lib/supabaseClient", you can switch to that.
import { supabase } from '../../../lib/supabaseClient';

/**
 * Turn a full URL or text into a compact, per-user slug
 * (we namespace uniqueness per user in the DB using onConflict: 'user_id,slug').
 */
function toSlug(input: string) {
  try {
    const u = new URL(input);
    // prefer first path segment; fall back to hostname
    const seg = u.pathname.split('/').filter(Boolean)[0] ?? '';
    const base = (seg || u.hostname).replace(/^www\./, '');
    return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  } catch {
    // if input isn't a valid URL, slugify whatever we got
    return input
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export default function NewRequestPage() {
  const [siteUrl, setSiteUrl] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Require login
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/';
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: userResp, error: userErr } = await supabase.auth.getUser();
    const user = userResp?.user;

    if (userErr || !user) {
      setLoading(false);
      window.location.href = '/';
      return;
    }

    // Build per-user slug for this target
    const slug = toSlug(siteUrl.trim());

    // 1) Ensure a target exists for THIS user.
    //    user_id is set by your BEFORE INSERT trigger.
    const { data: target, error: tErr } = await supabase
      .from('targets')
      .upsert(
        { slug },
        { onConflict: 'user_id,slug', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (tErr) {
      setLoading(false);
      alert(tErr.message);
      return;
    }

    // 2) Create the request pointing to that target
    const { error: rErr } = await supabase
      .from('requests')
      .insert({
        target_id: target.id,
        category: category || null,
        notes: notes || null,
      });

    setLoading(false);

    if (rErr) {
      alert(rErr.message);
      return;
    }

    // Go to the list
    window.location.href = '/requests';
  }

  return (
    <main style={{ maxWidth: 760, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24 }}>UnlistIN</h1>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        New Removal Request
      </h2>

      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
            Site URL *
          </label>
          <input
            type="url"
            required
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://example.com/profile/123"
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #ccc',
              borderRadius: 6,
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #ccc',
              borderRadius: 6,
              background: 'white',
            }}
          >
            <option value="">— Select —</option>
            <option value="Data Broker">Data Broker</option>
            <option value="People Search">People Search</option>
            <option value="Image/Photo">Image/Photo</option>
            <option value="News/Media">News/Media</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything specific to track for this takedown"
            rows={5}
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #ccc',
              borderRadius: 6,
              resize: 'vertical',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #ddd',
            background: loading ? '#f3f3f3' : '#f7f7f7',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? 'Saving…' : 'Create Request'}
        </button>
      </form>
    </main>
  );
}
