'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

type RequestRow = {
  id: number;
  created_at: string;
  category: string | null;
  status: string | null;
  notes: string | null;
};

type FileRow = {
  id: number;
  name: string | null;
  size_bytes: number | null;
  url: string | null;
};

const STATUSES = ['new', 'queued', 'in_progress', 'done'] as const;

export default function RequestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = useMemo(() => Number(params?.id), [params]);

  const [row, setRow] = useState<RequestRow | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load request + files, ensure user is logged in
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!requestId) return;

        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          router.push('/');
          return;
        }

        const [{ data: req, error: reqErr }, { data: f, error: fileErr }] =
          await Promise.all([
            supabase
              .from('requests')
              .select('id, created_at, category, status, notes')
              .eq('id', requestId)
              .single(),
            supabase
              .from('request_files')
              .select('id, name, size_bytes, url')
              .eq('request_id', requestId)
              .order('created_at', { ascending: false }),
          ]);

        if (reqErr) throw reqErr;
        if (fileErr) throw fileErr;
        if (!mounted) return;

        setRow(req as RequestRow);
        setFiles((f ?? []) as FileRow[]);
      } catch (e) {
        console.error(e);
        alert('Failed to load the request.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [requestId, router]);

  async function updateStatus(nextStatus: string) {
    if (!row) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: nextStatus })
        .eq('id', row.id);

      if (error) throw error;
      setRow({ ...row, status: nextStatus });
    } catch (e) {
      console.error(e);
      alert('Could not update status.');
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes(next: string) {
    if (!row) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ notes: next })
        .eq('id', row.id);

      if (error) throw error;
      setRow({ ...row, notes: next });
    } catch (e) {
      console.error(e);
      alert('Could not save notes.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFile(fileId: number) {
    if (!row) return;
    if (!confirm('Delete this file?')) return;

    try {
      const res = await fetch(`/api/requests/${row.id}/files/${fileId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Delete failed');

      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Delete failed');
    }
  }

  async function renameFile(fileId: number, currentName: string | null) {
    if (!row) return;

    const next = prompt('New file name:', currentName ?? '');
    if (next == null) return; // Cancelled
    const trimmed = next.trim();
    if (!trimmed) {
      alert('Name cannot be empty.');
      return;
    }

    try {
      const res = await fetch(`/api/requests/${row.id}/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Rename failed');

      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, name: trimmed } : f))
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Rename failed');
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  if (!row) {
    return <div style={{ padding: 24 }}>Not found.</div>;
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

      <h2 style={{ marginTop: 24 }}>Request #{row.id}</h2>
      <p style={{ color: '#666' }}>
        Created: {new Date(row.created_at).toLocaleString()}
      </p>

      {/* Status */}
      <div style={{ marginTop: 16 }}>
        <label style={{ fontWeight: 600, marginRight: 8 }}>Status:</label>
        <select
          value={row.status ?? 'new'}
          disabled={saving}
          onChange={e => updateStatus(e.target.value)}
          style={{ padding: 6 }}
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
          Notes
        </label>
        <textarea
          defaultValue={row.notes ?? ''}
          onBlur={e => saveNotes(e.target.value)}
          placeholder="Add any notes for this request…"
          rows={5}
          style={{
            width: '100%',
            border: '1px solid #ddd',
            borderRadius: 6,
            padding: 10,
            fontFamily: 'inherit',
            fontSize: 14,
          }}
        />
        <p style={{ color: '#777', marginTop: 6 }}>
          (Edits save automatically when the textarea loses focus.)
        </p>
      </div>

      {/* Files */}
      <h3 id="files" style={{ marginTop: 32 }}>
        Files
      </h3>

      {files.length === 0 ? (
        <p>No files uploaded.</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            border: '1px solid #eee',
            borderRadius: 8,
          }}
        >
          {files.map(f => (
            <li
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderTop: '1px solid #f2f2f2',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {f.name || '(untitled file)'}
                </div>
                <div style={{ color: '#777', fontSize: 12 }}>
                  {f.size_bytes ? `${(f.size_bytes / 1024).toFixed(1)} KB` : ''}
                </div>
                {f.url ? (
                  <div style={{ marginTop: 4 }}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => renameFile(f.id, f.name)}
                  style={{ padding: '6px 10px' }}
                >
                  Rename
                </button>
                <button
                  onClick={() => deleteFile(f.id)}
                  style={{ padding: '6px 10px' }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
