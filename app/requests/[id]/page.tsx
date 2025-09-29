"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams } from "next/navigation";

type RequestRow = {
  id: number;
  title?: string | null;
  description?: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at?: string;
  updated_at?: string;
};

const STATUS_OPTIONS: RequestRow["status"][] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, startTransition] = useTransition();
  const [req, setReq] = useState<RequestRow | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<RequestRow["status"]>("open");

  const refresh = async () => {
    setLoading(true);
    const res = await fetch(`/api/requests/${requestId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to load request");
      setLoading(false);
      return;
    }
    setReq(json.request);
    setTitle(json.request.title ?? "");
    setDesc(json.request.description ?? "");
    setStatus(json.request.status);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const created = useMemo(
    () => (req?.created_at ? new Date(req.created_at).toLocaleString() : ""),
    [req]
  );
  const updated = useMemo(
    () => (req?.updated_at ? new Date(req.updated_at).toLocaleString() : ""),
    [req]
  );

  const onSave = async () => {
    const body = { title, description: desc, status };

    // optimistic
    const prev = req;
    if (prev) setReq({ ...prev, title, description: desc, status });

    startTransition(async () => {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (prev) setReq(prev); // rollback
        alert(j?.error || "Save failed");
        return;
      }
      setReq(j.request);
      setTitle(j.request.title ?? "");
      setDesc(j.request.description ?? "");
      setStatus(j.request.status);
      alert("Saved");
    });
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!req) return <div className="p-6 text-red-600">Request not found</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Request #{req.id}</h1>
        <StatusPill status={req.status} />
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1">
          <label className="text-sm text-gray-600">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded-lg px-3 py-2"
            placeholder="Add a short title"
            maxLength={200}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm text-gray-600">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="border rounded-lg px-3 py-2 min-h-[120px]"
            placeholder="Describe the request…"
            maxLength={5000}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm text-gray-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RequestRow["status"])}
            className="border rounded-lg px-3 py-2"
          >
            {STATUS_OPTIONS.map((s) => (
              <option value={s} key={s}>
                {labelForStatus(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-500">
          {created && <div>Created: {created}</div>}
          {updated && <div>• Updated: {updated}</div>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg border bg-black text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={() => refresh()}
            disabled={saving}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function labelForStatus(s: RequestRow["status"]) {
  switch (s) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return s;
  }
}

function StatusPill({ status }: { status: RequestRow["status"] }) {
  const map: Record<RequestRow["status"], string> = {
    open: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    resolved: "bg-emerald-100 text-emerald-700",
    closed: "bg-gray-200 text-gray-700",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status]}`}>
      {labelForStatus(status)}
    </span>
  );
}
