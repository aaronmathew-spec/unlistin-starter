'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type FileRow = {
  id: string;
  name: string | null;
  path: string | null;
  contentType: string | null;
  size: number | null;
  created_at: string | null;
  signedUrl: string | null;
};

export default function RequestFilesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const requestId = params?.id;

  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  async function loadFiles() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/requests/${requestId}/files`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (res.status === 401) {
        // Not signed in – go to login
        router.push('/login');
        return;
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed to load files (HTTP ${res.status})`);
      }

      const data = (await res.json()) as { files: FileRow[] };
      setFiles(data.files || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load files.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (requestId) {
      loadFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const body = new FormData();
      body.append('file', file);

      const res = await fetch(`/api/requests/${requestId}/files`, {
        method: 'POST',
        body,
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Upload failed (HTTP ${res.status})`);
      }

      await loadFiles();
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Request Files</h1>

      <div className="mt-4 flex items-center gap-3">
        <label className="inline-flex items-center gap-2 rounded bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90 cursor-pointer">
          <input
            type="file"
            className="hidden"
            onChange={onUpload}
            disabled={uploading}
          />
          {uploading ? 'Uploading…' : 'Upload file'}
        </label>

        <button
          className="text-sm underline"
          onClick={loadFiles}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-sm text-neutral-500">Loading…</div>
      ) : files.length === 0 ? (
        <div className="mt-6 text-sm text-neutral-500">No files yet.</div>
      ) : (
        <ul className="mt-6 divide-y rounded border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{f.name ?? '(unnamed)'}</div>
                <div className="truncate text-xs text-neutral-500">
                  {f.contentType ?? 'unknown'} • {f.size ?? 0} bytes
                </div>
              </div>
              {f.signedUrl ? (
                <a
                  href={f.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-neutral-800 px-2 py-1 text-xs text-white hover:opacity-90"
                >
                  View / Download
                </a>
              ) : (
                <span className="text-xs text-neutral-500">no URL</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
