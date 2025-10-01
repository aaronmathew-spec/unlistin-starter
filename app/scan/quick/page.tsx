// app/scan/quick/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ScanHit = {
  broker: string;
  category: string;
  url: string;
  confidence: number; // 0..1
  matchedFields: string[];
  evidence: string[];
};

type ApiOk = { ok: true; results: ScanHit[]; tookMs?: number };
type ApiErr = { ok: false; error: string };

export default function QuickScanPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  const [loading, setLoading] = useState(false);
  const [ranOnce, setRanOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScanHit[]>([]);
  const [tookMs, setTookMs] = useState<number | undefined>(undefined);

  const canSubmit = useMemo(() => {
    return Boolean(fullName.trim() || email.trim() || city.trim());
  }, [fullName, email, city]);

  async function runScan() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setRanOnce(true);
    setResults([]);
    try {
      const res = await fetch("/api/scan/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim() || undefined,
          email: email.trim() || undefined,
          city: city.trim() || undefined,
        }),
      });
      const j: ApiOk | ApiErr = await res.json().catch(() => ({ ok: false, error: "Invalid server response" }));
      if (!res.ok || !("ok" in j) || !j.ok) {
        const msg = (!res.ok && (j as ApiErr)?.error) || (j as ApiErr)?.error || "Scan failed";
        setError(msg);
        setLoading(false);
        return;
      }
      setResults(j.results ?? []);
      setTookMs(j.tookMs);
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function createDraft(hit: ScanHit) {
    // Best-effort; UI-first flow. If endpoint is RLS-gated the error will be shown.
    const title = `Removal: ${hit.broker}`;
    const description = [
      `Category: ${hit.category}`,
      email ? `Email (redacted): ${maskEmail(email.trim())}` : "",
      fullName ? `Name: ${fullName.trim()}` : "",
      city ? `City: ${city.trim()}` : "",
      "",
      "Evidence (public links):",
      ...hit.evidence.map((e) => `• ${e}`),
      `URL: ${hit.url}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("/api/requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (res.ok) {
        alert("Draft created in Requests.");
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j?.error?.message || j?.error || "Could not create draft");
      }
    } catch {
      alert("Network error while creating draft");
    }
  }

  return (
    <main className="relative min-h-screen">
      {/* Soft aesthetic background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_-10%,rgba(99,102,241,.12),rgba(255,255,255,0))]" />
        <div
          className="absolute -top-36 left-1/2 h-[540px] w-[820px] -translate-x-1/2 rounded-full blur-3xl opacity-25"
          style={{ background: "linear-gradient(90deg,#A78BFA,#60A5FA,#34D399)" }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Header / Breadcrumbs */}
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-500">Unlistin</div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Quick Scan</h1>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Link href="/" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50">Home</Link>
            <Link href="/requests" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50">Requests</Link>
            <Link href="/ti" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50">Threat Intel</Link>
          </div>
        </header>

        {/* Hero card */}
        <section className="relative overflow-hidden rounded-3xl border bg-white shadow-[0_10px_40px_rgba(0,0,0,.06)]">
          <div className="absolute right-[-120px] top-[-100px] h-[300px] w-[300px] rounded-full blur-3xl opacity-20"
               style={{ background: "linear-gradient(45deg,#F472B6,#A78BFA)" }} />
          <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Private & server-only
              </div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                See where your personal info might appear online — <span className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent">without creating an account</span>.
              </h2>
              <p className="text-sm text-neutral-600">
                We only use the inputs below for this scan and <strong>do not store</strong> them.
                Results are redacted previews with allowlisted links.
              </p>

              {/* Form */}
              <div className="mt-2 grid gap-3">
                <Field
                  label="Full name (recommended)"
                  placeholder="e.g., Priya Sharma"
                  value={fullName}
                  onChange={setFullName}
                />
                <Field
                  label="Email (optional)"
                  placeholder="e.g., priya***@gmail.com"
                  value={email}
                  onChange={setEmail}
                />
                <Field
                  label="City / State (optional)"
                  placeholder="e.g., Mumbai, MH"
                  value={city}
                  onChange={setCity}
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    disabled={!canSubmit || loading}
                    onClick={runScan}
                    className="inline-flex items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                    title={!canSubmit ? "Provide at least one field" : "Run Quick Scan"}
                  >
                    {loading ? Spinner() : "Run Quick Scan"}
                  </button>
                  <div className="text-xs text-neutral-500">
                    Tip: Provide at least one field. <span className="hidden sm:inline">Name usually yields the most results.</span>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {error}
                  </div>
                ) : null}

                {typeof tookMs === "number" && ranOnce && (
                  <div className="text-xs text-neutral-500">Scan took {tookMs} ms.</div>
                )}
              </div>
            </div>

            {/* Visual: faux results & trust badges */}
            <div className="space-y-3">
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-medium">What you’ll see</div>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {[
                    { title: "Justdial", score: 0.82 },
                    { title: "Sulekha", score: 0.74 },
                    { title: "IndiaMART", score: 0.68 },
                  ].map((x) => (
                    <div key={x.title} className="rounded-lg border bg-white p-3">
                      <div className="text-[11px] text-neutral-500">Possible match</div>
                      <div className="mt-0.5 text-sm font-medium">{x.title}</div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-100">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
                          style={{ width: `${Math.round(x.score * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-4 text-xs text-neutral-600">
                • No persistent PII • CSP & RLS enforced • Strict domain allowlist
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Results</h3>
            <div className="text-xs text-neutral-500">
              {ranOnce ? (results.length ? `${results.length} matches` : "No matches yet") : "Run a scan to see matches"}
            </div>
          </div>

          {loading && <ResultsSkeleton />}

          {!loading && ranOnce && results.length === 0 && (
            <EmptyState />
          )}

          {!loading && results.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((r, i) => (
                <ResultCard
                  key={i}
                  hit={r}
                  onCreate={() => createDraft(r)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------------- UI bits ---------------- */

function Field({
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
    <label className="grid gap-1.5">
      <span className="text-xs text-neutral-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300"
      />
    </label>
  );
}

function ResultCard({ hit, onCreate }: { hit: ScanHit; onCreate: () => void }) {
  const pct = Math.min(97, Math.max(0, Math.round(hit.confidence * 100)));
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-[0_4px_18px_rgba(0,0,0,.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{hit.broker}</div>
          <div className="text-xs text-neutral-500">{hit.category}</div>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-xs text-neutral-700">
          Confidence {pct}%
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-neutral-100">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {hit.matchedFields?.length ? (
        <div className="mt-3 text-xs text-neutral-600">
          Matched: {hit.matchedFields.join(", ")}
        </div>
      ) : null}

      {hit.evidence?.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {hit.evidence.map((e, idx) => (
            <li key={idx} className="rounded-lg border bg-neutral-50 px-3 py-2">
              {e}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={hit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          Open evidence link
        </a>
        <button
          onClick={onCreate}
          className="rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          Create removal draft
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-white p-6 text-center">
      <div className="mx-auto h-10 w-10 rounded-full border" />
      <div className="mt-2 text-sm font-medium">No matches found (yet)</div>
      <p className="mt-1 text-sm text-neutral-600">
        Try with your full name, or add city/state for better precision. You can also explore potential leak
        previews in <Link className="underline" href="/ti">Threat Intel</Link>.
      </p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
            <div className="h-5 w-28 animate-pulse rounded bg-neutral-200" />
          </div>
          <div className="mt-3 h-1.5 w-full animate-pulse rounded bg-neutral-200" />
          <div className="mt-3 space-y-2">
            <div className="h-8 w-full animate-pulse rounded bg-neutral-100" />
            <div className="h-8 w-5/6 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="h-9 w-40 animate-pulse rounded bg-neutral-200" />
            <div className="h-9 w-44 animate-pulse rounded bg-neutral-900/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" role="progressbar" aria-label="Loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- utils ---------------- */

function maskEmail(v: string) {
  const [local, domain] = v.split("@");
  if (!domain) return "••••@••••";
  const first = local?.[0] ?? "•";
  const maskedLocal = first + "•".repeat(Math.max(1, Math.max(0, local?.length ?? 0) - 1));
  const parts = domain.split(".");
  const tld = parts.pop() ?? "";
  const maskedDomain = parts.map((p) => (p.length <= 2 ? "•".repeat(p.length) : p[0] + "•".repeat(p.length - 1))).join(".");
  return `${maskedLocal}@${maskedDomain}.${tld}`;
}
