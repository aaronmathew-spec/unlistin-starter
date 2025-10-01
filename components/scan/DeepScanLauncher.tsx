// components/scan/DeepScanLauncher.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  // pass whatever you collected in Quick Scan
  defaults?: { name?: string; email?: string; city?: string; query?: string };
};

type JobStatus = "queued" | "running" | "complete" | "error";

export default function DeepScanLauncher({ defaults }: Props) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(true);
  const [mask, setMask] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    { source: string; title: string; snippet: string; confidence: number; url?: string }[]
  >([]);

  // open modal
  const launch = () => {
    setOpen(true);
    setConsent(true);
    setMask(true);
    setEmailVerified(false);
    setJobId(null);
    setStatus(null);
    setPct(0);
    setError(null);
    setResults([]);
  };

  // start job
  const start = async () => {
    try {
      setError(null);
      const res = await fetch("/api/scan/deep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...defaults,
          consent,
          mask,
          emailVerified,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create job");
      setJobId(json.jobId);
      setStatus("queued");
    } catch (e: any) {
      setError(e?.message ?? "Failed to start Deep Scan");
    }
  };

  // poll
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/scan/jobs/${jobId}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Polling failed");
        setStatus(j.status);
        setPct(j.pct ?? 0);
        if (j.status === "complete") {
          setResults(j.results || []);
          return; // stop
        }
        if (j.status === "error") {
          setError(j.error || "Deep Scan error");
          return; // stop
        }
        if (!stop) setTimeout(tick, 1300); // keep polling
      } catch (e: any) {
        setError(e?.message ?? "Polling error");
      }
    };
    tick();
    return () => {
      stop = true;
    };
  }, [jobId]);

  return (
    <div className="mt-4">
      <button
        onClick={launch}
        className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50"
      >
        Run Deeper Scan
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Deep Scan</h3>
              <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
            </div>

            {!jobId ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  We’ll run a broader, consented scan across additional India-focused sources. We’ll
                  <b> not store PII</b> unless you choose to save results.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  I consent to perform a deeper scan across public/allowed sources.
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
                  Mask my email in requests (recommended).
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={emailVerified} onChange={(e) => setEmailVerified(e.target.checked)} />
                  My email is verified (optional; reduces abuse/false positives).
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={start}
                    disabled={!consent}
                    className="px-3 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
                  >
                    Start Deep Scan
                  </button>
                  <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-md border text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-700">
                  Status: <b>{status}</b> · {pct}%
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 bg-gray-800" style={{ width: `${pct}%` }} />
                </div>

                {error ? (
                  <div className="text-sm text-red-600">Error: {error}</div>
                ) : null}

                {status === "complete" ? (
                  results.length === 0 ? (
                    <div className="text-sm text-gray-600">No strong leads found. Try adding another hint (e.g., city).</div>
                  ) : (
                    <ul className="space-y-2">
                      {results.map((r, i) => (
                        <li key={i} className="border rounded p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{r.title}</div>
                            <div className="text-xs text-gray-500">conf: {(r.confidence * 100).toFixed(0)}%</div>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">{r.snippet}</div>
                          <div className="text-xs text-gray-400 mt-1">{r.source}</div>
                          {r.url ? (
                            <a className="text-xs underline mt-1 inline-block" href={r.url} target="_blank" rel="noreferrer">
                              Open source
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <div className="text-xs text-gray-500">
                    Scanning safe, public/allowed sources… You can keep this window open or come back later.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
