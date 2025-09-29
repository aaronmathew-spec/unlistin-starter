"use client";

import { useEffect, useMemo, useState } from "react";

type FileRow = {
  id: number;
  request_id: number;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
  path?: string | null;
};

export default function FilesTab({ requestId }: { requestId: number }) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 20;

  async function fetchPage(opts?: { reset?: boolean }) {
    const reset = !!opts?.reset;
    if (reset) {
      setFiles([]);
      setCursor(null);
      setHasMore(true);
      setError(null);
      setLoading(true);
    }
    try {
      const qs = new URLSearchParams();
      qs.set("limit", String(PAGE));
      if (!reset && cursor) qs.set("cursor", cursor);

      const res = await fetch(`/api/requests/${requestId}/files?` + qs.toString(), {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load files");

      setFiles((cur) => (reset ? data.files : cur.concat(data.files)));
      setCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.nextCursor));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const totalSize = useMemo(
    () =>
      files.reduce((acc, f) => acc + (typeof f.size_bytes === "number" ? f.size_bytes : 0), 0),
    [files]
  );

  async function handleDelete(fileId: number) {
    setBusy(fileId);
    setError(null);
    const prev = files;
    setFiles((cur) => cur.filter((f) => f.id !== fileId));
    try {
      const res = await fetch(`/api/requests/${requestId}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Delete failed");
      }
    } catch (e: any) {
      setFiles(prev); // rollback
      setError(e?.message ?? "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  function toKb(n: number) {
    if (!Number.isFinite(n)) return "-";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading && files.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm text-neutral-600">
        Loading files…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600">
          {files.length} file{files.length === 1 ? "" : "s"}
          {files.length > 0 && <> • total {toKb(totalSize)}</>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPage({ reset: true })}
            className="rounded-md border px-3 py-1 text-sm hover:bg-neutral-50"
          >
            Refresh
          </button>
          {hasMore && (
            <button
              onClick={() => fetchPage()}
              className="rounded-md border px-3 py-1 text-sm hover:bg-neutral-50"
            >
              Load more
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-neutral-500" colSpan={5}>
                  No files yet.
                </td>
              </tr>
            ) : (
              files.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{f.name}</td>
                  <td className="px-3 py-2">{f.mime || "-"}</td>
                  <td className="px-3 py-2">
                    {toKb(typeof f.size_bytes === "number" ? f.size_bytes : NaN)}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(f.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/requests/${requestId}/files/${f.id}/download`}
                        className="rounded-md border px-2 py-1 hover:bg-neutral-50"
                      >
                        Download
                      </a>
                      <button
                        onClick={() => handleDelete(f.id)}
                        disabled={busy === f.id}
                        className="rounded-md border px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        aria-busy={busy === f.id}
                      >
                        {busy === f.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loading && files.length > 0 && (
        <div className="text-sm text-neutral-500">Loading…</div>
      )}
    </div>
  );
}
