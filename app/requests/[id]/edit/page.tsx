'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

type RequestRow = {
  id: number;
  status: 'new' | 'queued' | 'in_progress' | 'done';
  category: string | null;
  notes: string | null;
  created_at: string;
};

const STATUSES = ['new', 'queued', 'in_progress', 'done'] as const;

export default function EditRequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const numericId = Number(id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form fields
  const [status, setStatus] =
    useState<RequestRow['status']>('new');
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Load the request
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('requests')
        .select('id, status, category, notes, created_at')
        .eq('id', numericId)
        .single();

      if (!mounted) return;

      if (error) {
        setError(error.message);
      } else if (data) {
        setStatus((data.status as RequestRow['status']) ?? 'new');
        setCategory(data.category ?? '');
        setNotes(data.notes ?? '');
      } else {
        setError('Request not found.');
      }

      setLoading(false);
    }
    if (!Number.isNaN(numericId)) load();

    return () => {
      mounted = false;
    };
  }, [numericId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from('requests')
      .update({
        status,
        category: category || null,
        notes: notes || null,
      })
      .eq('id', numericId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Go back to list
    router.push('/requests');
  }

  function onCancel() {
    router.push('/requests');
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <nav style={{ marginBottom: 16 }}>
        <a href="/requests" style={{ color: '#5b21b6' }}>
          ← Back to Requests
        </a>
      </nav>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Edit Request
      </h1>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p style={{ color: 'crimson' }}>Error: {error}</p>
      ) : (
        <form onSubmit={onSave} style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Status</span>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as RequestRow['status'])
              }
              style={{ padding: '8px 10px', width: 240 }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span>Category</span>
            <input
              placeholder="e.g. Data Broker"
              value={category}
              onChange={(e) => setCategory(e.currentTarget.value)}
              style={{ padding: '8px 10px', width: 360 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span>Notes</span>
            <textarea
              rows={5}
              placeholder="Optional notes…"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              style={{ padding: '8px 10px', width: 480 }}
            />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 14px',
                background: '#4f46e5',
                color: 'white',
                borderRadius: 6,
                border: 0,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{
                padding: '8px 14px',
                background: '#e5e7eb',
                borderRadius: 6,
                border: 0,
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
