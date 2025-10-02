// app/scan/deep/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeepScanPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canRun =
    (fullName.trim() || email.trim() || city.trim()) && consent && !loading;

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/scan/deep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim() || undefined,
          email: email.trim() || undefined,
          city: city.trim() || undefined,
          // the API persists only redacted previews by default
          // but we’ll create an encrypted artifact & audit (Evidence Locker)
          consent: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        const msg = json?.error || `HTTP ${res.status}`;
        setErr(msg || "Deep Scan failed. Please try again.");
      } else {
        // API returns { ok, runId, results, tookMs }
        if (json?.runId) {
          router.push(`/scan/results/${json.runId}`);
          return;
        }
        setErr("Deep Scan completed but run was not persisted.");
      }
    } catch (e: any) {
      setErr(e?.message || "Deep Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Deep Scan</h1>
        <p className="text-sm text-muted-foreground">
          Full India sweep. Artifacts are stored encrypted at rest (“Evidence
          Locker”) and the UI remains redacted by default. “Secure Reveal”
          decrypts server-side with a short TTL and an audit log.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LabeledInput
            label="Full name"
            placeholder="e.g., Priya Sharma"
            value={fullName}
            onChange={setFullName}
          />
          <LabeledInput
            label="Email"
            placeholder="e.g., priya***@gmail.com"
            value={email}
            onChange={setEmail}
          />
          <LabeledInput
            label="City / State"
            placeholder="e.g., Mumbai, MH"
            value={city}
            onChange={setCity}
          />
        </div>

        <div className="mt-4 rounded-lg border bg-white p-4 text-xs leading-5 text-gray-700">
          <strong>Consent:</strong> I understand UnlistIN will perform a
          comprehensive search and store necessary scan artifacts{" "}
          <em>encrypted at rest</em> with access restricted by policy. The UI
          will always show redacted previews. When I use “Secure Reveal”, the
          system decrypts server-side for a short time and logs who/when/why.
        </div>

        <label className="mt-3 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I provide explicit consent for encrypted artifact storage.
        </label>

        <div className="mt-4">
          <button
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            onClick={run}
            disabled={!canRun}
          >
            {loading ? "Running…" : "Run Deep Scan"}
          </button>
        </div>

        {err ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LabeledInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <input
        className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
