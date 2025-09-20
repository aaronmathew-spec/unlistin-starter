'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
// Use the same relative import depth you used on /requests/new
import supabase from '../../../../lib/supabaseClient';

type TargetLite = {
  id: number;
  slug: string | null;
  display_name: string | null;
};

type RequestRow = {
  id: number;
  created_at: string;
  status: string;
  category: string | null;
  notes: string | null;
  target: TargetLite | null;
};

type FileEntry = {
  name: string;
  created_at?: string;
  path?: string; // computed "<user_id>/<request_id>/<file>"
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [reqRow, setReqRow] = useState<RequestRow | null>(null);
  const [status, setStatus] = useState('new');
  const [notes, setNotes] = useState('');

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  const folderPrefix = useMemo(
    () => (userId ? `${userId}/${id}` : null),
    [userId, id]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Require login
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        window.location.href = '/';
        return;
      }
      setUserId(uid);

      // Load request with its target
      const { data, error } = await supabase
        .from('requests')
        .select(`
          id, created_at, status, notes, category,
          target:targets(id, slug, display_name)
        `)
        .eq('id', id)
        .single();

      if (error) {
        alert(`Failed to load request: ${error.message}`);
        setLoading(false);
        return;
      }

      const row = data as RequestRow;
      setReqRow(row);
      setStatus(row.status ?? 'new');
      setNotes(row.notes ?? '');

      await refreshFiles(uid);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function refreshFiles(uid = userId) {
    if (!uid) return;
    const prefix = `${uid}/${id}`;

    const { data, error } = await supabase
      .storage
      .from('request-files')
      .list(prefix, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      alert(`Error listing files: ${error.message}`);
      return;
    }

    setFiles(
      (data ?? []).map((f: any) => ({
        name: f.name,
        created_at: f.created_at,
        path: `${prefix}/${f.name}`,
      }))
    );
  }

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!reqRow) return;

    const { error } = await supabase
      .from('requests')
      .update({ status, notes })
      .eq('id', reqRow.id);

    if (error) {
      alert(`Error saving: ${error.message}`);
      return;
    }

    alert('Saved');
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset input
    if (!file || !folderPrefix) return;

    setUploading(true);
    const fileName = `${Date.now()}-${file.name}`;

    const { error } = await supabase
      .storage
      .from('request-files')
      .upload(`${folderPrefix}/${fileName}`, file, {
        upsert: false,
      });

    setUploading(false);

    if (error) {
      alert(`Upload failed: ${error.message}`);
      return;
    }

    await refreshFiles();
  }

  async function handleDownload(path: string) {
    const { data, error } = await supabase
      .storage
      .from('request-files')
      .createSignedUrl(path, 60);

    if (error) {
      alert(`Error creating link: ${error.message}`);
      return;
    }

    window.open(data.signedUrl, '_blank');
  }

  async function handleDelete(path: string) {
    if (!confirm('Delete this file?')) return;

    const { error } = await supabase
      .storage
      .from('request-files')
      .remove([path]);

    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }

    await refreshFiles();
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!reqRow) return <div style={{ padding: 24 }}>Not found</div>;

  const siteLabel =
    reqRow.target?.display_name || reqRow.target?.slug || '—';

  return (
    <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 16 }}>
        <a href="/requests">← Back to Requests</a>
      </div>

      <h1 style={{ marginBottom: 8 }}>Request #{reqRow.id}</h1>
      <div style={{ color: '#666', marginBottom: 24 }}>
        Created: {new Date(reqRow.created_at).toLocaleString()}
      </div>

      <div style={{ marginBottom: 24 }}>
        <strong>Site:</strong> {siteLabel}
        <br />
        <strong>Category:</strong> {reqRow.category || '—'}
      </div>

      <form onSubmit={handleSaveMeta} style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ display: 'block', marginTop: 6 }}
          >
            <option value="new">new</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
          </select>
        </label>

        <label style={{ display: 'block', margin: '16px 0 8px' }}>
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          style={{ width: '100%', display: 'block' }}
          placeholder="Internal notes…"
        />

        <button type="submit" style={{ marginTop: 12 }}>
          Save
        </button>
      </form>

      <h2>Files</h2>
      <div style={{ marginBottom: 12 }}>
        <input type="file" onChange={handleUpload} disabled={uploading || !folderPrefix} />
        {uploading && <span style={{ marginLeft: 8 }}>Uploading…</span>}
      </div>

      {files.length === 0 ? (
        <div style={{ color: '#666' }}>No files uploaded yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '8px 4px' }}>Name</th>
              <th style={{ padding: '8px 4px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.path} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={{ padding: '8px 4px' }}>{f.name}</td>
                <td style={{ padding: '8px 4px' }}>
                  <button onClick={() => handleDownload(f.path!)}>Download</button>
                  <button onClick={() => handleDelete(f.path!)} style={{ marginLeft: 8 }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
