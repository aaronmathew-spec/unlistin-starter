'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

type FileRow = {
  id: number;
  request_id: number;
  name: string;
  mime: string;            // ← use mime (DB column), not content_type
  size_bytes: number;
  created_at: string;
  path: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true } }
);

export default function RequestFilesPage() {
  const params = useParams<{ id: string }>();
  const requestId = useMemo(() => Number(params?.id), [params?.id]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load files
  useEffect(() => {
    let active = true;
    async function load() {
      if (!requestId) return;
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('request_files')
        // IMPORTANT: ask for mime, not content_type
        .select('id, request_id, name, mime, size_bytes, created_at, path')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (!active) return;
      if (error) {
        setError(error.message);
      } else {
        setRows((data ?? []) as FileRow[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [requestId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !requestId) return;

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`/api/requests/${requestId}/files`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Upload failed (${res.status})`);
      }

      // reload list
      const { data, error } = await supabase
        .from('request_files')
        .select('id, request_id, name, mime, size_bytes, created_at, path')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows((data ?? []) as FileRow[]);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      e.currentTarget.value = ''; // reset input
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="inline-flex items-center px-3 py-2 rounded bg-black text-white cursor-pointer">
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading ? 'Uploading…' : 'Upload file'}
        </label>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-gray-600">No files uploaded yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">MIME</th>
                  <th className="py-2 pr-4">Size</th>
                  <th className="py-2 pr-4">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2 pr-4">{r.mime}</td>
                    <td className="py-2 pr-4">
                      {Intl.NumberFormat().format(r.size_bytes)} B
                    </td>
                    <td className="py-2 pr-4">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
