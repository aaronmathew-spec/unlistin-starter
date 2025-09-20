'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

type RequestRow = {
  id: number;
  created_at: string;
  category: string | null;
  status: string | null;
  notes: string | null;
};

const STATUSES = ['new', 'queued', 'in_progress', 'done'] as const;

export default function RequestsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load current user's requests
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          // not logged in -> go home
          router.push('/');
          return;
        }

        const { data, error } = await supabase
          .from('requests')
          .select('id, created_at, category, status, notes')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        setRows((data ?? []) as RequestRow[]);
      } catch (e) {
        console.error('Failed to load requests:', e);
        alert('Error loading requests. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function updateStatus(id: number, nextStatus: string) {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: nextStatus })
        .eq('id', id);

      if (error) throw error;

      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r))
      );
    } catch (e) {
      console.error('Status update failed:', e);
      alert('Could not update status.');
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this request?')) return;

    try {
      const { error } = await supabase.from('requests').delete().eq('id', id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Could not delete this request.');
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: 16 }}>
      {/* Top nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>UnlistIN</h1>
        <nav style={{ display: 'flex', gap: 16 }}>
          <a href="/" style={{ color: 'purple' }}>
            Home
          </a>
          <a href="/requests" style={{ color: 'purple' }}>
            Requests
          </a>
        </nav>
      </div>

      <h2 style={{ marginTop: 24 }}>My Requests</h2>

      <div style={{ marginBottom: 16 }}>
        <a
          href="/requests/new"
          style={{
            display: 'inline-block',
            padding: '8px 12px',
            background: '#f3e8ff',
            border: '1px solid #e9d5ff',
            borderRadius: 6,
            color: '#7c3aed',
          }}
        >
          New Request
        </a>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid #eee',
            borderRadius: 8,
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#fafafa',
                  borderBottom: '1px solid #eee',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: 8 }}>Created</th>
                <th style={{ padding: 8 }}>Site</th>
                <th style={{ padding: 8 }}>Category</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Notes</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 8 }}>
                    {new Date(r.created_at).toLocaleString()}
                  </td>

                  {/* Site column — you can fill this later from a join to targets */}
                  <td style={{ padding: 8, color: '#777' }}>—</td>

                  <td style={{ padding: 8 }}>{r.category ?? '—'}</td>

                  <td style={{ padding: 8 }}>
                    <select
                      value={r.status ?? 'new'}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      style={{ padding: 6 }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td
                    style={{
                      padding: 8,
                      maxWidth: 320,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {r.notes || '—'}
                  </td>

                  <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                    {/* ✅ Edit goes to /requests/[id] (no /edit) */}
                    <button
                      onClick={() => router.push(`/requests/${r.id}`)}
                      style={{ padding: '6px 10px' }}
                    >
                      Edit
                    </button>

                    {/* ✅ Files jumps to the files section on the same page */}
                    <button
                      onClick={() => router.push(`/requests/${r.id}#files`)}
                      style={{ padding: '6px 10px' }}
                    >
                      Files
                    </button>

                    <button
                      onClick={() => remove(r.id)}
                      style={{ padding: '6px 10px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
