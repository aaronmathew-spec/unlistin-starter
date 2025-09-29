"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/components/toast";

type FileRow = {
  id: number;
  request_id: number;
  path: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

export default function RequestFilesPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;
  const { push } = useToast();

  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchPage = async (cursor?: string | null) => {
    const u = new URL(`/api/requests/${requestId}/files`, window.location.origin);
    u.searchParams.set("limit", "20");
    if (cursor) u.searchParams.set("cursor", cursor);
    const res = await fetch(u.toString(), { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      push({ message: json?.error || "Failed to load files", type: "error" });
      return { files: [] as FileRow[], nextCursor: null as string | null };
    }
    return { files: (json.files || []) as FileRow[], nextCursor: json.nextCursor ?? null };
  };

  const refresh = async () => {
    setLoading(true);
    const { files, nextCursor } = await fetchPage(null);
    setFiles(files);
    setNextCursor(nextCursor);
    setLoading(false);
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    const { files: more, nextCursor: nc } = await fetchPage(nextCursor);
    setFiles((prev) => [...prev, ...more]);
    setNextCursor(nc);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mime", file.type || "application/octet-stream");

      const res = await fetch(`/api/requests/${requestId}/files`, {
        method: "POST",
        body: form,
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        push({ message: `Upload failed: ${j?.error || res.statusText}`, type: "error" });
      } else {
        push({ message: "File uploaded", type: "success" });
        await refresh();
      }
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  const onDelete = async (fileId: number) => {
    if (!confirm("Delete this file? This cannot be undone.")) return;

    startTransition(async () => {
      const res = await fetch(`/api/requests/${requestId}/files?fileId=${fileId}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        push({ message: `Delete failed: ${j?.error || res.statusText}`, type: "error" });
      } else {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        push({ message: "File deleted", type: "success" });
      }
    });
  };

  const onDownload = (fileId: number) => {
    window.location.href = `/api/requests/${requestId}/files/${fileId}/download`;
  };

  const totalSize = useMemo(
    () => files.reduce((s, f) => s + (f.size_bytes || 0), 0),
    [files]
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Files</h1>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-600">
            {uploading ? "Uploading…" : "Upload"}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={onUpload}
            disabled={uploading}
          />
          <span className="px-3 py-1 rounded-md border text-sm">
            Choose file
          </span>
        </label>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading files…</div>
      ) : files.length === 0 ? (
        <div className="text-gray-500">No files yet.</div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-right px-4 py-2">Size</th>
                  <th className="text-left px-4 py-2">Created</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="px-4 py-2">
                      <span title={f.path} className="font-medium">
                        {f.name}
                      </span>
                    </td>
                    <td className="px-4 py-2">{f.mime || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {formatBytes(f.size_bytes || 0)}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(f.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onDownload(f.id)}
                          className="px-3 py-1 rounded-md border hover:bg-gray-50"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => onDelete(f.id)}
                          disabled={pending}
                          className="px-3 py-1 rounded-md border text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 text-gray-600">
                <tr>
                  <td className="px-4 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatBytes(totalSize)}
                  </td>
                  <td className="px-4 py-2" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {nextCursor && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMore}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatBytes(n: number) {
  if (n === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
