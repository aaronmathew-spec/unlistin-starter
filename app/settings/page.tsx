"use client";

import { useEffect, useState } from "react";

type Prefs = { enabled: boolean; scope: string[] };

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ enabled: false, scope: [] });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auto/prefs", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setPrefs(j.prefs || { enabled: false, scope: [] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save(next: Partial<Prefs>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/auto/prefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...prefs, ...next }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to save");
      setPrefs(j.prefs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Central controls for automation and privacy behavior. Buttons elsewhere are minimized to keep the
        experience clean.
      </p>

      {error && <div className="mt-4 text-sm text-red-500">Error: {error}</div>}

      <div className="mt-6 grid gap-4">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-medium">Intelligent Auto-Run</div>
              <div className="mt-1 text-sm text-muted-foreground">
                When enabled, UnlistIN automatically prepares safe removal actions from high-confidence scan hits.
                Only allowlisted URLs are used; no raw PII is stored. Ambiguous cases are held for review.
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={!!prefs.enabled}
                onChange={(e) => save({ enabled: e.target.checked })}
                disabled={saving || loading}
                aria-label="Toggle Intelligent Auto-Run"
              />
              <span
                className={[
                  "relative inline-block h-6 w-11 rounded-full border transition",
                  prefs.enabled ? "bg-emerald-600" : "bg-background",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition",
                    prefs.enabled ? "translate-x-6" : "translate-x-0.5",
                  ].join(" ")}
                />
              </span>
            </label>
          </div>

          <div className="mt-4 grid gap-2">
            <div className="text-sm font-medium">Scope (optional)</div>
            <div className="text-xs text-muted-foreground">
              Future-ready: limit Auto-Run to selected networks. Leave blank for recommended defaults.
            </div>
            <div className="flex flex-wrap gap-2">
              {["justdial", "sulekha", "indiamart"].map((id) => {
                const on = prefs.scope?.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => {
                      const next = new Set(prefs.scope || []);
                      if (on) next.delete(id);
                      else next.add(id);
                      void save({ scope: Array.from(next) });
                    }}
                    disabled={saving || loading}
                    className={[
                      "rounded-full border px-3 py-1 text-xs",
                      on ? "bg-accent" : "bg-background",
                    ].join(" ")}
                    aria-pressed={on}
                    aria-label={`Toggle scope ${id}`}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-base font-medium">Privacy & Guardrails</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Quick Scan stores no PII; Auto-Run only uses redacted previews + allowlisted evidence.</li>
            <li>Deep Scan artifacts remain encrypted at rest; “Secure Reveal” has short TTL with audit logs.</li>
            <li>Every automated action is signed in the Proof-of-Action Ledger for public verification.</li>
          </ul>
        </section>

        <div className="text-xs text-muted-foreground">
          {loading ? "Loading…" : saving ? "Saving…" : "Up to date."}
        </div>
      </div>
    </div>
  );
}
