"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";

type RequestRow = {
  id: number;
  title: string | null;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string | null;
  updated_at: string | null;
};

type FileRow = {
  id: number;
  request_id: number;
  path: string;
  name: string;
  mime: string;
  size_bytes: number | null;
  created_at: string | null;
};

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const rid = Number(params.id);

  const [reqRow, setReqRow] = useState<RequestRow | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  // upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // per-file action state
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  const sizeFmt = (n?: number | null) =>
    !n && n !== 0
      ? "—"
      : n < 1024
      ? `${n} B`
      : n < 1024 * 1024
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / (1024 * 1024)).toFixed(1)} MB`;

  async function fetchRequest() {
    const j = await fetch(`/api/requests/${rid}`, { cache: "no-store" }).then((r) => r.json());
    setReqRow(j.request ?? null);
  }
  async function fetchFiles() {
    const j = await fetch(`/api/requests/${rid}/files`, { cache: "no-store" }).then((r) => r.json());
    setFiles((j.files ?? []) as FileRow[]);
  }

  async function refresh() {
    setLoading(true);
    await Promise.all([fetchRequest(), fetchFiles()]);
    setLoading(false);
  }

  useEffect(() => {
    if (!Number.isFinite(rid)) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  const title = useMemo(
    () => (reqRow?.title ? `Request #${rid} – ${reqRow.title}` : `Request #${rid}`),
    [rid, reqRow?.title]
  );

  // Upload handler — assumes your POST /api/requests/[id]/files is already wired for form-data
  async function onUpload(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    if (!input || !input.files || input.files.length === 0) return;

    const file = input.files[0];
    const fd = new FormData();
    fd.set("file", file);
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/requests/${rid}/files`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Upload failed (${res.status})`);
      }
      toast("File uploaded");
      input.value = "";
      await fetchFiles();
    } catch (e: any) {
      setUploadError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function signAndOpen(fid: number) {
    setBusy((m) => ({ ...m, [fid]: true }));
    try {
      const j = await fetch(`/api/requests/${rid}/files/${fid}/sign`).then((r) => r.json());
      const url = j?.signedUrl as string | undefined;
      if (!url) throw new Error(j?.error || "Could not sign URL");
      // Open in new tab (user gesture assumed from click)
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast(e?.message || "Download failed");
    } finally {
      setBusy((m) => {
        const n = { ...m };
        delete n[fid];
        return n;
      });
    }
  }

  async function signAndCopy(fid: number) {
    setBusy((m) => ({ ...m, [fid]: true }));
    try {
      const j = await fetch(`/api/requests/${rid}/files/${fid}/sign`).then((r) => r.json());
      const url = j?.signedUrl as string | undefined;
      if (!url) throw new Error(j?.error || "Could not sign URL");
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch (e: any) {
      toast(e?.message || "Copy failed");
    } finally {
      setBusy((m) => {
        const n = { ...m };
        delete n[fid];
        return n;
      });
    }
  }

  async function removeFile(fid: number) {
    if (!confirm("Delete this file?")) return;
    setBusy((m) => ({ ...m, [fid]: true }));
    try {
      const res = await fetch(`/api/requests/${rid}/files/${fid}/delete`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Delete failed (${res.status})`);
      }
      setFiles((prev) => prev.filter((f) => f.id !== fid));
      toast("File deleted");
    } catch (e: any) {
      toast(e?.message || "Delete failed");
    } finally {
      setBusy((m) => {
        const n = { ...m };
        delete n[fid];
        return n;
      });
    }
  }

  if (!Number.isFinite(rid)) {
    return (
      <div className="p-6">
        <div className="text-red-600">Invalid request id</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        <Link href="/requests" className="px-3 py-1 rounded border hover:bg-gray-50">
          Back to Requests
        </Link>
      </header>

      {loading ? (
        <div>Loading…</div>
      ) : !reqRow ? (
        <div className="text-gray-600">Not found.</div>
      ) : (
        <>
          {/* About */}
          <section className="border rounded-xl p-4 space-y-2">
            <div className="font-medium">About</div>
            <div className="text-sm">
              <div><span className="text-gray-600">Status:</span> {reqRow.status.replace("_", " ")}</div>
              <div><span className="text-gray-600">Updated:</span> {reqRow.updated_at ? new Date(reqRow.updated_at).toLocaleString() : "—"}</div>
            </div>
            {reqRow.description && (
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{reqRow.description}</p>
            )}
          </section>

          {/* Files */}
          <section className="border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Files</h2>
              <form onSubmit={onUpload} className="flex items-center gap-2">
                <input name="file" type="file" className="text-sm" disabled={uploading} />
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-3 py-1 rounded border hover:bg-gray-50 text-sm"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </form>
            </div>
            {uploadError && <div className="text-sm text-red-600">{uploadError}</div>}

            {files.length === 0 ? (
              <div className="text-gray-600 text-sm">No files yet.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Size</th>
                    <th className="text-left px-4 py-2">Uploaded</th>
                    <th className="text-right px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => {
                    const isBusy = !!busy[f.id];
                    return (
                      <tr key={f.id} className="border-t">
                        <td className="px-4 py-2">{f.name}</td>
                        <td className="px-4 py-2">{f.mime || "—"}</td>
                        <td className="px-4 py-2">{sizeFmt(f.size_bytes)}</td>
                        <td className="px-4 py-2">{f.created_at ? new Date(f.created_at).toLocaleString() : "—"}</td>
                        <td className="px-4 py-2 text-right space-x-2">
                          <button
                            disabled={isBusy}
                            onClick={() => signAndOpen(f.id)}
                            className="px-2 py-1 rounded border hover:bg-gray-50"
                          >
                            {isBusy ? "…" : "Download"}
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => signAndCopy(f.id)}
                            className="px-2 py-1 rounded border hover:bg-gray-50"
                          >
                            {isBusy ? "…" : "Copy link"}
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => removeFile(f.id)}
                            className="px-2 py-1 rounded border hover:bg-gray-50"
                          >
                            {isBusy ? "…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
