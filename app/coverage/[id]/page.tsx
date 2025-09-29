"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";
import { fileEmoji, humanSize } from "@/lib/fileIcons";

type CoverageRow = {
  id: number;
  broker_id: number;
  surface: string;
  status: "open" | "in_progress" | "resolved";
  weight: number | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type FileRow = {
  id: number;
  coverage_id: number;
  path: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

type Act = {
  id: number;
  entity_type: "request" | "coverage" | "broker" | "file";
  entity_id: number;
  action: "create" | "update" | "status" | "delete" | "upload" | "download";
  meta: Record<string, unknown> | null;
  created_at: string;
};

const STATUSES: CoverageRow["status"][] = ["open", "in_progress", "resolved"];

export default function CoverageDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { toast } = useToast();

  const [row, setRow] = useState<CoverageRow | null>(null);
  const [loading, setLoading] = useState(true);

  // edit form
  const [surface, setSurface] = useState("");
  const [status, setStatus] = useState<CoverageRow["status"]>("open");
  const [weight, setWeight] = useState<string>("1");
  const [note, setNote] = useState("");

  // files
  const [files, setFiles] = useState<FileRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  // timeline
  const [activity, setActivity] = useState<Act[]>([]);
  const [actCursor, setActCursor] = useState<string | null>(null);
  const [actLoading, setActLoading] = useState(true);

  const createdAt = useMemo(
    () => (row?.created_at ? new Date(row.created_at).toLocaleString() : "—"),
    [row]
  );
  const updatedAt = useMemo(
    () => (row?.updated_at ? new Date(row.updated_at).toLocaleString() : "—"),
    [row]
  );

  async function fetchCoverage() {
    const u = new URL("/api/coverage", window.location.origin);
    u.searchParams.set("limit", "1");
    u.searchParams.set("cursor", String(id + 1)); // trick to fetch <= id then filter
    const list = await fetch(u.toString(), { cache: "no-store" }).then((r) => r.json());
    const items: CoverageRow[] = list.coverage ?? [];
    const found = items.find((c) => c.id === id) ?? null;
    if (!found) {
      setRow(null);
      return;
    }
    setRow(found);
    setSurface(found.surface);
    setStatus(found.status);
    setWeight(String(found.weight ?? 1));
    setNote(found.note ?? "");
  }

  async function fetchFiles(cursor?: string | null) {
    const u = new URL(`/api/coverage/${id}/files`, window.location.origin);
    u.searchParams.set("limit", "30");
    if (cursor) u.searchParams.set("cursor", cursor);
    const j = await fetch(u.toString(), { cache: "no-store" }).then((r) => r.json());
    const list = (j.files ?? []) as FileRow[];
    if (cursor) setFiles((prev) => [...prev, ...list]);
    else setFiles(list);
    setNextCursor(j.nextCursor ?? null);
  }

  async function fetchActivity(cursor?: string | null) {
    setActLoading(true);
    // Reuse global activity API with entity filters
    const u = new URL("/api/activity", window.location.origin);
    u.searchParams.set("limit", "50");
    u.searchParams.set("entity_type", "coverage");
    u.searchParams.set("entity_id", String(id));
    if (cursor) u.searchParams.set("cursor", cursor);
    const j = await fetch(u.toString(), { cache: "no-store" }).then((r) => r.json());
    const list = (j.activity ?? []) as Act[];
    if (cursor) setActivity((prev) => [...prev, ...list]);
    else setActivity(list);
    setActCursor(j.nextCursor ?? null);
    setActLoading(false);
  }

  async function refreshAll() {
    setLoading(true);
    await Promise.all([fetchCoverage(), fetchFiles(null), fetchActivity(null)]);
    setLoading(false);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveMeta() {
    const payload: Partial<CoverageRow> & { id: number } = {
      id,
      surface: surface.trim(),
      status,
      weight: Number(weight) || 1,
      note: note.trim() || null,
    };
    const res = await fetch("/api/coverage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast("Saved");
      await Promise.all([fetchCoverage(), fetchActivity(null)]);
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j?.error || "Update failed");
    }
  }

  async function onUploadMany(filesList: FileList) {
    setUploadBusy(true);
    try {
      const arr = Array.from(filesList);
      for (const f of arr) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("mime", f.type || "application/octet-stream");
        const res = await fetch(`/api/coverage/${id}/files`, { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Upload failed: ${f.name}`);
        }
      }
      toast(`Uploaded ${arr.length} file${arr.length > 1 ? "s" : ""}`);
      await Promise.all([fetchFiles(null), fetchActivity(null)]);
    } catch (e: any) {
      toast(e?.message || "Upload error");
    } finally {
      setUploadBusy(false);
    }
  }

  async function onDeleteFile(fileId: number) {
    const ok = confirm("Delete this file?");
    if (!ok) return;
    const res = await fetch(`/api/coverage/${id}/files?fileId=${fileId}`, { method: "DELETE" });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast("Deleted");
      if (previewUrl && previewName) {
        setPreviewUrl(null);
        setPreviewName(null);
      }
      await fetchActivity(null);
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j?.error || "Delete failed");
    }
  }

  async function copySignedUrl(fileId: number) {
    const res = await fetch(`/api/coverage/${id}/files/${fileId}/sign`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(j?.error || "Could not sign URL");
      return;
    }
    const j = await res.json();
    await navigator.clipboard.writeText(j.signedUrl);
    toast("Link copied (5 min)");
  }

  async function previewFile(fileId: number, name: string, mime: string | null) {
    const isImage = (mime || "").startsWith("image/");
    const isPdf = mime === "application/pdf" || (name || "").toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) {
      window.location.href = `/api/coverage/${id}/files/${fileId}/download`;
      return;
    }
    const res = await fetch(`/api/coverage/${id}/files/${fileId}/sign`);
    if (!res.ok) {
      toast("Could not sign URL");
      return;
    }
    const j = await res.json();
    setPreviewUrl(j.signedUrl);
    setPreviewName(name);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }
  if (!row) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <Link href="/coverage" className="underline text-blue-600">
            ← Back to coverage
          </Link>
        </div>
        <div>Coverage not found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Coverage #{row.id}</div>
          <h1 className="text-xl font-semibold">Coverage Details</h1>
        </div>
        <Link href="/coverage" className="px-3 py-1 rounded border hover:bg-gray-50">
          Back
        </Link>
      </div>

      {/* Meta editor */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Meta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-gray-600">Surface</label>
            <input
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
              placeholder="Surface"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CoverageRow["status"])}
              className="border rounded-lg px-3 py-2 w-full"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-600">Weight</label>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
              type="number"
              min={1}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-gray-600">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full min-h-[96px]"
              placeholder="Optional note"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveMeta} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Save
          </button>
          <div className="text-xs text-gray-500 ml-auto">
            Created: {createdAt} · Updated: {updatedAt}
          </div>
        </div>
      </section>

      {/* Files */}
      <section className="border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Files</h2>
          <label className="text-sm">
            <input
              type="file"
              multiple
              disabled={uploadBusy}
              onChange={(e) => e.target.files && onUploadMany(e.target.files)}
              className="hidden"
              id="fileInput"
            />
            <span
              className={`px-3 py-1 rounded border hover:bg-gray-50 cursor-pointer ${
                uploadBusy ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              {uploadBusy ? "Uploading…" : "Upload files"}
            </span>
          </label>
        </div>

        {(files ?? []).length === 0 ? (
          <div className="text-sm text-gray-600">No files yet.</div>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between border rounded p-2 text-sm gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="text-lg">{fileEmoji(f.mime, f.name)}</div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{f.name}</div>
                    <div className="text-gray-500">
                      {(f.mime || "file")} · {humanSize(f.size_bytes)} ·{" "}
                      {new Date(f.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => previewFile(f.id, f.name, f.mime)}
                    className="px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    Preview
                  </button>
                  <a
                    href={`/api/coverage/${id}/files/${f.id}/download`}
                    className="px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => copySignedUrl(f.id)}
                    className="px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={() => onDeleteFile(f.id)}
                    className="px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div>
            <button
              onClick={() => fetchFiles(nextCursor)}
              className="px-3 py-1 rounded border hover:bg-gray-50"
            >
              Load more
            </button>
          </div>
        )}

        {previewUrl && (
          <div className="border rounded-lg p-2">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium truncate pr-4">Preview — {previewName}</div>
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  setPreviewName(null);
                }}
                className="px-2 py-1 rounded border hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            {isPdfName(previewName) ? (
              <iframe src={previewUrl} className="w-full h-[70vh] rounded" title={previewName || "Preview"} />
            ) : (
              <img src={previewUrl} alt={previewName || "Preview"} className="max-h-[70vh] object-contain mx-auto" />
            )}
          </div>
        )}
      </section>

      {/* Timeline */}
      <section className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Timeline</h2>
          {actCursor && (
            <button
              onClick={() => fetchActivity(actCursor)}
              className="px-3 py-1 rounded border hover:bg-gray-50"
            >
              Load more
            </button>
          )}
        </div>
        {actLoading ? (
          <div>Loading…</div>
        ) : activity.length === 0 ? (
          <div className="text-sm text-gray-600">No activity yet.</div>
        ) : (
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="border rounded p-3 text-sm flex items-start justify-between">
                <div className="pr-4">
                  <div className="font-medium">
                    {prettyEntity(a.entity_type)} #{a.entity_id} — {prettyAction(a.action)}
                  </div>
                  {a.meta ? (
                    <pre className="mt-1 text-xs text-gray-600 whitespace-pre-wrap break-words">
                      {JSON.stringify(a.meta, null, 2)}
                    </pre>
                  ) : null}
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function label(s: CoverageRow["status"]) {
  switch (s) {
    case "open": return "Open";
    case "in_progress": return "In Progress";
    case "resolved": return "Resolved";
  }
}
function isPdfName(name: string | null) {
  return (name || "").toLowerCase().endsWith(".pdf");
}
function prettyEntity(t: Act["entity_type"]) {
  switch (t) {
    case "request": return "Request";
    case "coverage": return "Coverage";
    case "broker": return "Broker";
    case "file": return "File";
  }
}
function prettyAction(a: Act["action"]) {
  switch (a) {
    case "create": return "Created";
    case "update": return "Updated";
    case "status": return "Status Changed";
    case "delete": return "Deleted";
    case "upload": return "Uploaded";
    case "download": return "Downloaded";
  }
}
