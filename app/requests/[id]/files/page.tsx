'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

type FileObject = {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
};

const BUCKET = 'unlistin';

export default function RequestFilesPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const prefix = useMemo(() => `${id}`, [id]);

  const [files, setFiles] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function listFiles() {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { sortBy: { column: 'updated_at', order: 'desc' } });

    if (error) setErrorMsg(error.message);
    setFiles(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    listFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);

    const path = `${prefix}/${file.name}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true });

    if (error) setErrorMsg(error.message);
    setUploading(false);
    await listFiles();
  }

  async function onDownload(name: string) {
    setErrorMsg(null);
    const path = `${prefix}/${name}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60); // 60s signed URL

    if (error || !data?.signedUrl) {
      setErrorMsg(error?.message || 'Could not create signed URL');
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  async function onDelete(name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setErrorMsg(null);
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([`${prefix}/${name}`]);

    if (error) setErrorMsg(error.message);
    await listFiles();
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <nav style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <a href="/requests" style={{ color: '#5b21b6' }}>← Back to Requests</a>
        <button onClick={() => router.refresh()} style={{ padding: '6px 10px' }}>
          Refresh
        </button>
      </nav>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Files for Request #{id}
      </h1>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            border: '1px solid #e5e7eb',
            padding: '8px 12px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <input
            type="file"
            onChange={onUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          {uploading ? 'Uploading…' : 'Upload a file'}
        </label>
      </div>

      {errorMsg && (
        <div style={{ color: '#b91c1c', marginBottom: 12 }}>{errorMsg}</div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : files.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No files yet.</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #e5e7eb',
          }}
        >
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={th}>File</th>
              <th style={th}>Size</th>
              <th style={th}>Type</th>
              <th style={{ ...th, width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.name}>
                <td style={td}>{f.name}</td>
                <td style={td}>
                  {f.metadata?.size ? formatBytes(f.metadata.size) : '—'}
                </td>
                <td style={td}>{f.metadata?.mimetype ?? '—'}</td>
                <td style={{ ...td, display: 'flex', gap: 8 }}>
                  <button style={btn} onClick={() => onDownload(f.name)}>
                    Download
                  </button>
                  <button style={btnDanger} onClick={() => onDelete(f.name)}>
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

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid #e5e7eb',
  fontWeight: 600,
  color: '#374151',
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
};

const btn: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  ...btn,
  color: '#b91c1c',
  borderColor: '#fecaca',
  background: '#fff5f5',
};

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
