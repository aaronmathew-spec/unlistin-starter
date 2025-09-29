"use client";

import { useState, useTransition } from "react";

async function patchStatus(id: number, status: string) {
  const res = await fetch(`/api/requests/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { updated: boolean; status: string };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-md p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function StatusChanger({
  requestId,
  initial,
}: {
  requestId: number;
  initial?: string | null;
}) {
  const [status, setStatus] = useState(initial ?? "open");
  const [pending, start] = useTransition();

  const opts = ["open", "in_review", "approved", "changes_requested", "done", "archived"];

  return (
    <Section title="Status">
      <div className="flex items-center gap-2">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                await patchStatus(requestId, status);
              } catch {
                // quiet failure in SSR builds
              }
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </Section>
  );
}
