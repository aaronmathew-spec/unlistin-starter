'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

type RequestRow = {
  id: string | number;
  site_url: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  // add any other fields you store on requests
};

type FileRow = {
  id: string;
  name: string | null;
  path: string;
  contentType: string | null;
  size: number | null;
  created_at: string;
  signedUrl: string | null; // provided by the API
};

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const requestId = params?.id as string;

  const [tab, setTab] = React.useState<'overview' | 'files'>(() =>
    (typeof window !== 'undefined' && window.location.hash.replace('#', '')) === 'files' ? 'files' : 'overview'
  );

  React.useEffect(() => {
    const setFromHash = () => {
      const h = window.location.hash.replace('#', '');
      setTab(h === 'files' ? 'files' : 'overview');
    };
    setFromHash();
    window.addEventListener('hashchange', setFromHash);
    return () => window.removeEventListener('hashchange', setFromHash);
  }, []);

  return (
    <div style={{ maxWidth: 920, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 16 }}>Request #{requestId}</h1>

      <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <a
          href="#overview"
          style={{
            textDecoration: 'none',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #ddd',
            background: tab === 'overview' ? '#000' : '#fff',
            color: tab === 'overview' ? '#fff' : '#000',
          }}
        >
          Overview
        </a>
        <a
          href="#files"
          style={{
            textDecoration: 'none',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #ddd',
            background: tab === 'files' ? '#000' : '#fff',
            color: tab === 'files' ? '#fff' : '#000',
          }}
        >
          Files
        </a>
      </nav>

      {tab === 'overview' ? (
        <OverviewSection requestId={requestId} />
      ) : (
        <FilesSection requestId={requestId} />
      )}
    </div>
  );
}

/* -------------------- Overview -------------------- */

function OverviewSection({ requestId }: { requestId: string }) {
  const [data, setData] = React.useState<RequestRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/requests/${requestId}`, { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed to load request (${res.status})`);
        }
        const body = (await res.json()) as { request: RequestRow | null };
        if (mounted) setData(body.request ?? null);
      } catch (e: any) {
        console.error(e);
        if (mounted) setError(e.message || 'Failed to load request.');
        alert('Failed to load the request.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [requestId]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: 'crimson' }}>{error}</p>;
  if (!data) return <p>Not found.</p>;

  return (
    <div style={{ lineHeight: 1.6 }}>
      <div>
        <strong>Site URL:</strong> {data.site_url ?? '—'}
      </div>
      <div>
        <strong>Category:</strong> {data.category ?? '—'}
      </div>
      <div>
        <strong>Notes:</strong> {data.notes ?? '—'}
      </div>
      <div style={{ color: '#666' }}>
        <strong>Created:</strong> {new Date(data.created_at).toLocaleString()}
      </div>
    </div>
  );
}

/* -------------------- Files (uses API only) -------------------- */

function FilesSection({ requestId }: { requestId: string }) {
  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
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
    if (!f) return;

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
      e.currentTarget.value = '';
    }
  }

  return (
    <div>
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
          <input type="file" onChange={onSelectFile} disabled={uploading} style={{ display: 'none' }} />
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
                  {f.contentType ?? 'unknown'} • {formatBytes(f.size)} • {new Date(f.created_at).toLocaleString()}
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
