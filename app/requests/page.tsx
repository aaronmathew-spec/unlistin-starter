'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Request = {
  id: string;
  site_url: string;
  category: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export default function RequestsPage() {
  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userResp } = await supabase.auth.getUser();
      if (!userResp.user) { window.location.href = '/'; return; }
      const { data, error } = await supabase
        .from('requests')
        .select('id, site_url, category, status, notes, created_at')
        .order('created_at', { ascending: false });
      if (error) alert(error.message);
      setItems(data || []);
      setLoading(false);
    })();
  }, []);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('requests').update({ status }).eq('id', id);
    if (error) return alert(error.message);
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  if (loading) return <p>Loading…</p>;

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>My Requests</h2>
        <a href="/requests/new" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}>New Request</a>
      </div>

      {items.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>Created</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>Site</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>Category</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>Status</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 8 }}>{new Date(r.created_at).toLocaleString()}</td>
                <td style={{ padding: 8, wordBreak: 'break-all' }}>
                  <a href={r.site_url} target="_blank">{r.site_url}</a>
                </td>
                <td style={{ padding: 8 }}>{r.category || '—'}</td>
                <td style={{ padding: 8 }}>
                  <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)}>
                    <option value="new">new</option>
                    <option value="in_progress">in_progress</option>
                    <option value="submitted">submitted</option>
                    <option value="completed">completed</option>
                    <option value="error">error</option>
                  </select>
                </td>
                <td style={{ padding: 8, maxWidth: 320, whiteSpace: 'pre-wrap' }}>{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
