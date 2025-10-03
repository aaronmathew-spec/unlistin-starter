/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

type FlagsResponse = {
  ok: boolean;
  flags: {
    ai_ui: boolean;
    ai_server: boolean;
    agents_ui: boolean;
    agents_server: boolean;
  };
};

type AdapterControlsResponse = {
  ok: boolean;
  controls: Record<
    string,
    {
      killed?: boolean;
      daily_cap?: number | null;
      min_confidence?: number | null;
    }
  >;
};

export default function ControlsClient() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Flags
  const [flags, setFlags] = React.useState<FlagsResponse["flags"]>({
    ai_ui: false,
    ai_server: false,
    agents_ui: false,
    agents_server: false,
  });

  // Adapter controls
  const [adapters, setAdapters] = React.useState<
    AdapterControlsResponse["controls"]
  >({});

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flagsRes, ctrlRes] = await Promise.all([
        fetch("/api/admin/flags", { cache: "no-store" }),
        fetch("/api/admin/adapter/controls", { cache: "no-store" }),
      ]);

      if (!flagsRes.ok) {
        throw new Error(`flags GET ${flagsRes.status}`);
      }
      if (!ctrlRes.ok) {
        throw new Error(`controls GET ${ctrlRes.status}`);
      }

      const flagsJson = (await flagsRes.json()) as FlagsResponse;
      const ctrlJson = (await ctrlRes.json()) as AdapterControlsResponse;

      if (!flagsJson.ok) throw new Error("flags not ok");
      if (!ctrlJson.ok) throw new Error("controls not ok");

      setFlags(flagsJson.flags);
      setAdapters(ctrlJson.controls);
    } catch (e: any) {
      setError(e?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Save flags
  async function saveFlags() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ai_ui: flags.ai_ui,
          ai_server: flags.ai_server,
          agents_ui: flags.agents_ui,
          agents_server: flags.agents_server,
        }),
      });
      if (!res.ok) throw new Error(`flags POST ${res.status}`);
      const json = await res.json();
      if (!json?.ok) throw new Error("flags save failed");
    } catch (e: any) {
      setError(e?.message || "Failed to save flags");
    } finally {
      setSaving(false);
    }
  }

  // Save single adapter patch
  async function saveAdapter(adapterId: string, patch: Partial<{ killed: boolean; daily_cap: number | null; min_confidence: number | null }>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/adapter/controls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adapterId, patch }),
      });
      if (!res.ok) throw new Error(`controls POST ${res.status}`);
      const json = await res.json();
      if (!json?.ok) throw new Error("adapter save failed");
      // optimistic: merge patch into local state
      setAdapters((prev) => ({
        ...prev,
        [adapterId]: { ...(prev[adapterId] || {}), ...patch },
      }));
    } catch (e: any) {
      setError(e?.message || "Failed to save adapter controls");
    } finally {
      setSaving(false);
    }
  }

  function setAdapterField(adapterId: string, key: "killed" | "daily_cap" | "min_confidence", value: any) {
    setAdapters((prev) => ({
      ...prev,
      [adapterId]: {
        ...(prev[adapterId] || {}),
        [key]: value,
      },
    }));
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Feature Flags */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-base font-medium">Feature Flags</div>
          <button
            onClick={saveFlags}
            disabled={saving}
            className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FlagToggle
            label="AI (UI)"
            checked={flags.ai_ui}
            onChange={(v) => setFlags((f) => ({ ...f, ai_ui: v }))}
            description="Enable AI surfaces in the UI"
          />
          <FlagToggle
            label="AI (Server)"
            checked={flags.ai_server}
            onChange={(v) => setFlags((f) => ({ ...f, ai_server: v }))}
            description="Enable AI server workflows"
          />
          <FlagToggle
            label="Agents (UI)"
            checked={flags.agents_ui}
            onChange={(v) => setFlags((f) => ({ ...f, agents_ui: v }))}
            description="Enable Agents surfaces in the UI"
          />
          <FlagToggle
            label="Agents (Server)"
            checked={flags.agents_server}
            onChange={(v) => setFlags((f) => ({ ...f, agents_server: v }))}
            description="Enable Agents server workflows"
          />
        </div>
      </section>

      {/* Adapter Controls */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-2 text-base font-medium">Adapter Controls</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(adapters).length === 0 ? (
            <div className="text-sm text-muted-foreground">No adapters found.</div>
          ) : (
            Object.entries(adapters).map(([adapterId, ctl]) => (
              <div key={adapterId} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{adapterId}</div>
                  <button
                    onClick={() =>
                      saveAdapter(adapterId, {
                        killed: !!ctl.killed,
                        daily_cap: normalizeNum(ctl.daily_cap),
                        min_confidence: normalizeNum(ctl.min_confidence),
                      })
                    }
                    disabled={saving}
                    className="rounded-md border px-3 py-1 text-xs hover:bg-accent disabled:opacity-60"
                  >
                    {saving ? "…" : "Save"}
                  </button>
                </div>

                <div className="mt-3 space-y-3 text-sm">
                  <label className="flex items-center justify-between">
                    <span>Kill Switch</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!ctl.killed}
                      onChange={(e) => setAdapterField(adapterId, "killed", e.target.checked)}
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <span>Daily Cap</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="w-28 rounded-md border px-2 py-1"
                      placeholder="e.g. 50"
                      value={ctl.daily_cap ?? ""}
                      onChange={(e) =>
                        setAdapterField(adapterId, "daily_cap", e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <span>Min Confidence</span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={1}
                      className="w-28 rounded-md border px-2 py-1"
                      placeholder="0–1"
                      value={ctl.min_confidence ?? ""}
                      onChange={(e) =>
                        setAdapterField(
                          adapterId,
                          "min_confidence",
                          e.target.value === "" ? null : clamp01(Number(e.target.value))
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="text-xs text-muted-foreground">
        Changes take effect immediately. All automation is allowlist-guarded and respects server-side controls.
      </div>
    </div>
  );
}

function FlagToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div>
        <div className="font-medium">{label}</div>
        {description ? (
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <input
        type="checkbox"
        className="h-5 w-5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function clamp01(n: number | null | undefined) {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeNum(n: number | null | undefined) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n;
}
