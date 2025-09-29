"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

const STATUSES: RequestRow["status"][] = ["open", "in_progress", "resolved", "closed"];

export default function RequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const router = useRouter();
  const { toast } = useToast();

  const [reqRow, setReqRow] = useState<RequestRow | null>(null);
  const [loading, setLoading] = useState(true);

  // edit form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<RequestRow["status"]>("open");

  // files
  const [files, setFiles] = useState<FileRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const createdAt = useMemo(
    () => (reqRow?.created_at ? new Date(reqRow.created_at).toLocaleString() : "—"),
    [reqRow]
  );
  const updatedAt = useMemo(
    () => (reqRow?.updated_at ? new Date(reqRow.updated_at).toLocaleString() : "—"),
    [reqRow]
  );

  // ----- data fetching -----
  async function fetchRequest() {
    const res = await fetch(`/api/requests/${id}`, { cache: "no-store" });
    if (!res.ok) {
      toast("Not found");
      router.push("/requests");
      return;
    }
    const j = await res.json();
    const row = (j.request ?? j) as RequestRow; // support older shape
    setReqRow(row);
    setTitle(row.title ?? "");
    setDesc(row.description ?? "");
    setStatus(row.status);
  }

  async function fetchFiles(cursor?: string | null) {
    const u = new URL(`/api/requests/${id}/files`, window.location.origin);
    u.searchParams.set("limit", "30");
    if (cursor) u.searchParams.set("cursor", cursor);
    const j = await fetch(u.toString(), { cache: "no-store" }).then((r) => r.json());
    const list = (j.files ?? []) as FileRow[];
    if (cursor) {
      setFiles((prev) => [...prev, ...list]);
    } else {
      setFiles(list);
    }
    setNextCursor(j.nextCursor ?? null);
  }

  async function refreshAll() {
    setLoading(true);
    await Promise.all([fetchRequest(), fetchFiles(null)]);
    setLoading(false);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ----- actions -----
  async function saveMeta() {
    const payload: Partial<RequestRow> & { id: number } = {
      id,
      title: title.trim(),
      description: desc.trim(),
      status,
    };
    const res = await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast("Saved");
      await fetchRequest();
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j?.error || "Update failed");
    }
  }

  async function setQuickStatus(s: RequestRow["status"]) {
    setStatus(s);
    const res = await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: s }),
    });
    if (res.ok) {
      toast(`Marked ${label(s)}`);
      await fetchRequest();
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j?.error || "Status update failed");
    }
  }

  async function onUpload(file: File) {
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // if your API reads `mime` from FormData, we can pass it explicitly:
      fd.append("mime", file.type || "application/octet-stream");
      const res = await fetch(`/api/requests/${id}/files`, { method: "POST", body: fd });
      if (res.ok) {
        toast("Uploaded");
        await fetchFiles(null);
      } else {
        const j = await res.json().catch(() => ({}));
        toast(j?.error || "Upload failed");
      }
    } finally {
      setUploadBusy(false);
    }
  }

  async function onDeleteFile(fileId: number) {
    const okay = confirm("Delete this file?");
    if (!okay) return;
    const res = await fetch(`/api/requests/${id}/files?fileId=${fileId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast("Deleted");
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j?.error || "Delete failed");
    }
  }

  // ----- render -----
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }
  if (!reqRow) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <Link href="/requests" className="underline text-blue-600">
            ← Back to requests
          </Link>
        </div>
        <div>Request not found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Request #{reqRow.id}</div>
          <h1 className="text-xl font-semibold">Request Details</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={reqRow.status} />
          <Link href="/requests" className="px-3 py-1 rounded border hover:bg-gray-50">
            Back
          </Link>
        </div>
      </div>

      {/* Meta editor */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Meta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-gray-600">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
              placeholder="Request title"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RequestRow["status"])}
              className="border rounded-lg px-3 py-2 w-full"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs text-gray-600">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full min-h-[96px]"
              placeholder="Optional description"
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

      {/* Quick statuses */}
      <section className="border rounded-xl p-4 space-y-2">
        <h2 className="font-medium">Quick Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setQuickStatus(s)}
              className="px-3 py-1 rounded border hover:bg-gray-50"
            >
              {label(s)}
            </button>
          ))}
        </div>
      </section>

      {/* Files */}
      <section className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Files</h2>
          <label className="text-sm">
            <input
              type="file"
              disabled={uploadBusy}
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              className="hidden"
              id="fileInput"
            />
            <span className={`px-3 py-1 rounded border hover:bg-gray-50 cursor-pointer ${uploadBusy ? "opacity-60 pointer-events-none" : ""}`}>
              {uploadBusy ? "Uploading…" : "Upload"}
            </span>
          </label>
        </div>

        {(files ?? []).length === 0 ? (
          <div className="text-sm text-gray-600">No files yet.</div>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between border rounded p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-gray-500">
                    {f.mime || "file"} · {(f.size_bytes ?? 0).toLocaleString()} bytes ·{" "}
                    {new Date(f.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/requests/${id}/files/${f.id}/download`}
                    className="px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    Download
                  </a>
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
      </section>
    </div>
  );
}

/* --------------------- UI bits --------------------- */

function StatusBadge({ status }: { status: RequestRow["status"] }) {
  const { bg, text } = statusStyle(status);
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label(status)}
    </span>
  );
}

function label(s: RequestRow["status"]) {
  switch (s) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
  }
}

function statusStyle(s: RequestRow["status"]) {
  if (s === "resolved" || s === "closed") {
    return { bg: "bg-emerald-100", text: "text-emerald-700" };
  }
  if (s === "in_progress") {
    return { bg: "bg-amber-100", text: "text-amber-700" };
  }
  return { bg: "bg-gray-100", text: "text-gray-700" };
}
