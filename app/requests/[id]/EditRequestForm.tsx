"use client";

import { useEffect, useState } from "react";

type RequestRow = {
  id: number;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "closed" | string;
  created_at: string;
};

export default function EditRequestForm({ initial }: { initial: RequestRow }) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [status, setStatus] = useState<RequestRow["status"]>(initial.status);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initial.title);
    setDescription(initial.description ?? "");
    setStatus(initial.status);
  }, [initial]);

  async function onSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/requests/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Update failed");
      setMsg("Saved");
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {(err || msg) && (
        <div
          className={
            "rounded-md border p-3 text-sm " +
            (err ? "border-red-300 bg-red-50 text-red-800" : "border-green-300 bg-green-50 text-green-800")
          }
        >
          {err || msg}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-xs text-neutral-500">Title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            maxLength={200}
          />
        </label>
        <label className="block">
          <div className="mb-1 text-xs text-neutral-500">Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>

      <label className="block">
        <div className="mb-1 text-xs text-neutral-500">Description</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[120px] w-full rounded-md border px-3 py-2 text-sm"
          maxLength={5000}
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
