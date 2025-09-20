'use client';

import { useEffect, useMemo, useState } from 'react';
import supabase from '../../../lib/supabaseClient';

/**
 * Convert any string into a slug.
 * “Example Site” -> “example-site”
 */
function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*/, '') // strip path if user pasted a full URL; keeps host
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Visible options -> DB-safe values.
 * Adjust the right-side values if your requests.type enum uses different tokens.
 */
const TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Data Broker', value: 'data_broker' },
  { label: 'Search Engine', value: 'search' },
  { label: 'News/Media', value: 'news' },
  { label: 'Aggregator/Directory', value: 'directory' },
  { label: 'Other', value: 'other' },
];

export default function NewRequestPage() {
  const [siteUrl, setSiteUrl] = useState('');
  const [typeLabel, setTypeLabel] = useState(TYPE_OPTIONS[0].label);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect to home if not logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/';
    });
  }, []);

  const typeValue = useMemo(
    () => TYPE_OPTIONS.find((t) => t.label === typeLabel)?.value ?? 'other',
    [typeLabel]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteUrl.trim()) {
      alert('Please enter a site URL.');
      return;
    }

    setLoading(true);

    try {
      // Reconfirm auth on submit
      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp?.user;
      if (!user) {
        window.location.href = '/';
        return;
      }

      // Build a per-user slug/display name for the target
      const displayName = siteUrl.trim().replace(/https?:\/\//, '').replace(/\/$/, '');
      const slug = toSlug(siteUrl);

      // 1) Ensure a target exists for THIS user
      const { data: target, error: tErr } = await supabase
        .from('targets')
        .upsert(
          {
            // user_id is set by your BEFORE INSERT trigger
            slug,
            display_name: displayName, // many schemas require this to be NOT NULL
          },
          { onConflict: 'user_id,slug', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (tErr || !target?.id) {
        alert(`Error saving target: ${tErr?.message ?? 'no target returned'}`);
        setLoading(false);
        return;
      }

      const targetId = target.id; // safe after the guard

      // 2) Insert the request that points to that target.
      //    Only send columns that definitely exist in your schema.
      //    If your table uses "category" rather than "type", or both, adjust below.
      const { error: rErr } = await supabase.from('requests').insert({
        target_id: targetId,
        type: typeValue,        // <-- satisfies NOT NULL + CHECK on requests.type
        notes: notes || null,
     });

      if (rErr) {
        alert(`Error creating request: ${rErr.message}`);
        setLoading(false);
        return;
      }

      setLoading(false);
      window.location.href = '/requests';
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      {/* simple header + crumb */}
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>UnlistIN</h1>
      <div style={{ marginBottom: 24 }}>
        <a href="/" style={{ color: '#5b21b6', textDecoration: 'underline', marginRight: 12 }}>
          Home
        </a>
        <a href="/requests" style={{ color: '#5b21b6', textDecoration: 'underline' }}>
          Requests
        </a>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>New Removal Request</h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Site URL */}
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Site URL *</span>
          <input
            type="url"
            placeholder="https://example.com/profile/123"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            required
            style={{
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </label>

        {/* Category / Type */}
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Category</span>
          <select
            value={typeLabel}
            onChange={(e) => setTypeLabel(e.target.value)}
            style={{
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              background: '#fff',
            }}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Notes */}
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Notes</span>
          <textarea
            rows={5}
            placeholder="Anything specific to track for this takedown"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              resize: 'vertical',
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 8,
            padding: '12px 14px',
            borderRadius: 8,
            background: loading ? '#ddd' : '#5b21b6',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Saving…' : 'Create Request'}
        </button>
      </form>
    </div>
  );
}
