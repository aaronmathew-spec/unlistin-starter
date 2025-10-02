// app/actions/page.tsx
"use client";

import { useEffect, useState } from "react";

type Action = {
  id: string;
  created_at: string;
  updated_at: string;
  broker: string;
  category: string;
  status: string;
  redacted_identity: {
    namePreview?: string;
    emailPreview?: string;
    cityPreview?: string;
  };
  evidence: { url: string; note?: string }[];
  draft_subject?: string | null;
  draft_body?: string | null;
  reply_channel?: "email" | "portal" | "phone";
  reply_email_preview?: string | null;
  proof_hash?: string | null;
  proof_sig?: string | null;
};

export default function ActionsPage() {
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/actions", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setActions(j.actions || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function advance(id: string, status: string) {
    setLoading(true);
    try {
      const r = await fetch("/api/actions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, update: { status } }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Update failed");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Action Queue</h1>
        <button
          onClick={load}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Track removal actions, update statuses, and verify cryptographic proof without storing raw PII.
      </p>

      {error && <div className="mt-4 text-sm text-red-500">Error: {error}</div>}

      <div className="mt-6 space-y-4">
        {actions.map((a) => (
          <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <div className="font-semibold">{a.broker}</div>
                <div className="text-muted-foreground">{a.category}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Created {new Date(a.created_at).toLocaleString()}
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="text-sm">
                <div className="font-semibold">Identity</div>
                <div className="mt-1 rounded-md border bg-background p-3">
                  <div>Name: {a.redacted_identity?.namePreview || "—"}</div>
                  <div>Email: {a.redacted_identity?.emailPreview || "—"}</div>
                  <div>City: {a.redacted_identity?.cityPreview || "—"}</div>
                </div>
              </div>

              <div className="text-sm">
                <div className="font-semibold">Draft</div>
                <div className="mt-1 rounded-md border bg-background p-3">
                  <div className="font-medium">{a.draft_subject || "—"}</div>
                  <div className="mt-1 line-clamp-4 text-xs whitespace-pre-wrap">
                    {a.draft_body || "—"}
                  </div>
                </div>
              </div>

              <div className="text-sm">
                <div className="font-semibold">Proof</div>
                <div className="mt-1 rounded-md border bg-background p-3">
                  <div className="text-xs break-all">hash: {a.proof_hash || "—"}</div>
                  <div className="text-xs break-all">sig: {a.proof_sig || "—"}</div>
                  {a.id && (
                    <a
                      href={`/api/ledger/verify?id=${encodeURIComponent(a.id)}`}
                      target="_blank"
                      className="mt-2 inline-block text-xs underline"
                    >
                      Verify publicly
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="text-sm">
                <span className="rounded-full border px-2 py-0.5">{a.status}</span>
              </div>
              <div className="ml-auto flex gap-2">
                {["prepared", "sent", "follow_up_due", "resolved", "cancelled"].map((s) => (
                  <button
                    key={s}
                    onClick={() => advance(a.id, s)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    disabled={loading}
                  >
                    Mark {s.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {actions.length === 0 && !loading && (
          <div className="text-sm text-muted-foreground">No actions yet.</div>
        )}
      </div>
    </div>
  );
}
