// app/requests/new/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../../../lib/supabaseClient';

function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function displayFromUrl(input: string) {
  try {
    const u = new URL(input);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return input.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

export default function NewRequestPage() {
  const [siteUrl, setSiteUrl] = useState('');
  const [category, setCategory] = useState('Data Broker');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Require login for this page (redirect to "/")
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/';
    });
  }, []);

  async function tryUpsertTarget({
    slug,
    url,
    display_name,
  }: {
    slug: string;
    url: string;
    display_name: string;
  }) {
    // Try with { slug, url, display_name } first.
    let res = await supabase
      .from('targets')
      .upsert({ slug, url, display_name }, { onConflict: 'user_id,slug', ignoreDuplicates: false })
      .select('id')
      .single();

    if (res.error) {
      const msg = `${res.error.message || ''} ${res.error.details || ''}`.toLowerCase();

      // If the API cache doesn't know the 'url' column (or it truly doesn't exist), try without it.
      if (msg.includes("column 'url'") || msg.includes('url') || msg.includes('schema cache')) {
        res = await supabase
          .from('targets')
          .upsert({ slug, display_name }, { onConflict: 'user_id,slug', ignoreDuplicates: false })
          .select('id')
          .single();
      }
    }
    return res;
  }

  async function tryInsertRequest(payloadBase: any) {
    // Some projects have a CHECK constraint on requests.type.
    // We’ll try a few safe candidates; the first that passes wins.
    const TYPE_CANDIDATES = ['removal', 'takedown', 'privacy', 'dmca', 'other'];

    for (const t of TYPE_CANDIDATES) {
      const { data, error } = await supabase
        .from('requests')
        .insert({ ...payloadBase, type: t })
        .select('id')
        .single();
      if (!error) return { data, error: null };

      const msg = (error.message || '').toLowerCase();
      if (!msg.includes('check constraint') && !msg.includes('violates check')) {
        // Different error (not the type check) — stop and report it.
        return { data: null, error };
      }
      // else: try the next candidate
    }
    return {
      data: null,
      error: {
        message:
          "Your 'requests.type' CHECK constraint rejected common values. Either adjust the constraint or set a default.",
        details:
          "Quick fix (run in Supabase SQL):  alter table public.requests drop constraint if exists requests_type_check;",
      },
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Make sure we have the logged in user
      const { data: userResp, error: userErr } = await supabase.auth.getUser();
      const user = userResp?.user;
      if (userErr || !user) {
        throw new Error('You must be logged in to create a request.');
      }

      // Basic validation
      const trimmedUrl = siteUrl.trim();
      if (!trimmedUrl) throw new Error('Please enter a site URL.');

      // Prepare target fields
      const slug = toSlug(trimmedUrl);
      const display_name = displayFromUrl(trimmedUrl);

      // Create (or ensure) target for this user
      let { data: target, error: tErr } = await tryUpsertTarget({
        slug,
        url: trimmedUrl,
        display_name,
      });

      if (tErr || !target?.id) {
        // If upsert failed because row already exists but select failed,
        // try to select the row by slug for this user.
        const { data: existing, error: selErr } = await supabase
          .from('targets')
          .select('id')
          .eq('slug', slug)
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          target = existing as any;
        } else {
          throw new Error(
            tErr?.message ||
              selErr?.message ||
              "Couldn't create or locate the target row. Check your 'targets' columns and policies."
          );
        }
      }

      // Insert a request that points to that target
      const basePayload = {
        target_id: target.id,
        category,
        notes: notes || null,
        status: 'open', // harmless if your table has a default; ignored if the column doesn’t exist
      };

      const { data: reqData, error: reqErr } = await tryInsertRequest(basePayload);
      if (reqErr) {
        const friendly =
          reqErr.details ||
          reqErr.message ||
          'Insert failed. Verify the columns in public.requests and your RLS policies.';
        throw new Error(friendly);
      }

      // Done!
      window.location.href = '/requests';
    } catch (err: any) {
      alert(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '3rem auto', padding: '0 1rem' }}>
      {/* Simple header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>UnlistIN</h1>
        <nav style={{ display: 'flex', gap: 16 }}>
          <Link href="/">Home</Link>
          <Link href="/requests">Requests</Link>
        </nav>
      </header>

      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>New Removal Request</h2>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16, background: '#fafafa', padding: 20, borderRadius: 8 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="siteUrl" style={{ fontWeight: 600 }}>
            Site URL <span style={{ color: '#cc0000' }}>*</span>
          </label>
          <input
            id="siteUrl"
            type="url"
            required
            placeholder="https://example.com/profile/123"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            style={{
              border: '1px solid #ddd',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="category" style={{ fontWeight: 600 }}>
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ border: '1px solid #ddd', borderRadius: 6, padding: '10px 12px', fontSize: 14 }}
          >
            <option>Data Broker</option>
            <option>Search Index</option>
            <option>Forum/Blog</option>
            <option>Social</option>
            <option>Other</option>
          </select>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="notes" style={{ fontWeight: 600 }}>
            Notes
          </label>
          <textarea
            id="notes"
            rows={5}
            placeholder="Anything specific to track for this takedown"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ border: '1px solid #ddd', borderRadius: 6, padding: '10px 12px', fontSize: 14 }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            background: '#111827',
            color: '#fff',
            border: 0,
            borderRadius: 8,
            padding: '12px 14px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Saving…' : 'Create Request'}
        </button>
      </form>
    </div>
  );
}
