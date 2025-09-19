'use client';

import { useEffect, useState } from 'react';
import supabase from '../../../lib/supabaseClient'; // <-- adjust only if your path differs

/** Turn a URL or free text into a URL-safe slug. */
function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/** Try to produce a nice display name from a URL; fall back to slug. */
function toDisplayNameFromUrl(urlText: string, fallbackSlug: string): string {
  try {
    const u = new URL(urlText.trim());
    const host = u.hostname.replace(/^www\./, '');
    // If we also have a pathname that looks meaningful, keep just first segment
    const firstPath = u.pathname.split('/').filter(Boolean)[0];
    if (firstPath) return `${host}/${firstPath}`;
    return host || fallbackSlug;
  } catch {
    // If not a valid URL, just use the slug
    return fallbackSlug;
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

    try {
      // Confirm user
      const { data: userResp, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userResp.user;
      if (!user) {
        window.location.href = '/';
        return;
      }

      // Derive slug + display_name
      const slug = toSlug(siteUrl.trim());
      const display_name = toDisplayNameFromUrl(siteUrl.trim(), slug);

      // Ensure there is a target for THIS user. (user_id gets set by your BEFORE INSERT trigger.)
      const { data: target, error: tErr } = await supabase
        .from('targets')
        .upsert(
          { slug, display_name }, // <--- include display_name to satisfy NOT NULL
          { onConflict: 'user_id,slug', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (tErr) throw tErr;
      if (!target?.id) throw new Error('Could not create/find target.');

      // Create the request
      const { error: rErr } = await supabase.from('requests').insert({
        target_id: target.id,
        site_url: siteUrl.trim(),
        category: category || null,
        notes: notes || null,
      });

      if (rErr) throw rErr;

      alert('Request created!');
      // send them to requests list (or wherever you want)
      window.location.href = '/requests';
    } catch (err: any) {
      // Surface helpful errors
      const msg =
        err?.message ||
        err?.error ||
        'Something went wrong while creating your request.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '3rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: 0 }}>UnlistIN</h1>
      <h2 style={{ marginTop: '0.5rem' }}>New Removal Request</h2>

      <form onSubmit={submit} style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Site URL *</div>
          <input
            type="url"
            required
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://example.com/profile/123"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d0d7de',
              borderRadius: 6,
              fontSize: 15,
            }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Category</div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d0d7de',
              borderRadius: 6,
              fontSize: 15,
              background: 'white',
            }}
          >
            <option value="">— Select —</option>
            <option value="Data Broker">Data Broker</option>
            <option value="Search Engine">Search Engine</option>
            <option value="Social Network">Social Network</option>
            <option value="Scraper / Aggregator">Scraper / Aggregator</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything specific to track for this takedown"
            rows={6}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d0d7de',
              borderRadius: 6,
              fontSize: 15,
              resize: 'vertical',
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 14px',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 6,
            border: '1px solid #1f6feb',
            background: loading ? '#9ec1ff' : '#2f81f7',
            color: 'white',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Saving…' : 'Create Request'}
        </button>
      </form>
    </main>
  );
}
