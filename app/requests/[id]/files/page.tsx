'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

type FileRow = {
  id: string;
  name: string | null;
  path: string;
  contentType: string | null;
  size: number | null;
  created_at: string;
  signedUrl: string | null;
};

export default function RequestFilesPage() {
  const params = useParams<{ id: string }>();
  const requestId = params?.id as string;

  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/files`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to load files (${res.status})`);
      }
      const body = (await res.json()) as { files: FileRow[] };
      setFiles(body.files ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to load files.');
      alert('Failed to load the request.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !requestId) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', f);

      const res = await fetch(`/api/requests/${requestId}/files`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Upload failed (${res.status})`);
      }

      const { file } = (await res.json()) as { file: FileRow };
      setFiles((prev) => [file, ...prev]);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Upload failed.');
      alert('Upload failed.');
    } finally {
      setUploading(false);
      // reset input so same file can be selected again
      e.currentTarget.value = '';
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 16 }}>Request Files</h1>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'inline-block',
            padding: '10px 14px',
            borderRadius: 8,
            background: '#000',
            color: '#fff',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? 'Uploading…' : 'Upload file'}
          <input
            type="file"
            onChange={onSelectFile}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p style={{ color: 'crimson' }}>{error}</p>
      ) : files.length === 0 ? (
        <p>No files yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {files.map((f) => (
            <li
              key={f.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid #eee',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>
                  {f.name ?? f.path.split('/').pop()}
                </div>
                <div style={{ color: '#666', fontSize: 12 }}>
                  {f.contentType ?? 'unknown'} • {formatBytes(f.size)} •{' '}
                  {new Date(f.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                {f.signedUrl ? (
                  <a
                    href={f.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: 'none',
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: 6,
                    }}
                  >
                    View
                  </a>
                ) : (
                  <span style={{ color: '#999' }}>No preview</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number | null | undefined) {
  const v = typeof n === 'number' ? n : 0;
  if (v < 1024) return `${v} B`;
  const kb = v / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}
