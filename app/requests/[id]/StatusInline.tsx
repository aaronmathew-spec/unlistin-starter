"use client";

import { useState, useTransition } from "react";

const OPTIONS = [
  { v: "open", label: "Open" },
  { v: "in_progress", label: "In Progress" },
  { v: "closed", label: "Closed" },
];

export default function StatusInline({
  requestId,
  initialStatus,
}: {
  requestId: number;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onChange(next: string) {
    const prev = status;
    setStatus(next);
    setErr(null);
    start(async () => {
      try {
        const res = await fetch(`/api/requests/${requestId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to update status");
        }
      } catch (e: any) {
        setStatus(prev); // rollback
        setErr(e?.message ?? "Failed to update status");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-md border px-2 py-1 text-sm"
      >
        {OPTIONS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-neutral-500">Saving…</span>}
      {err && (
        <span className="text-xs text-red-700" role="alert">
          {err}
        </span>
      )}
    </div>
  );
}
