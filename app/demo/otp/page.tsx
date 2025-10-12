"use client";

import { useState } from "react";
import { waitForOtp } from "@/lib/otp";

export default function OtpWaitDemo() {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [requestId, setRequestId] = useState("101"); // default to your test id

  async function handleWait() {
    setLoading(true);
    setErr(null);
    setCode(null);

    try {
      const res = await waitForOtp({
        requestId,
        timeoutMs: 20000,       // wait up to 20s
        pollIntervalMs: 2000,   // check every 2s
        withinMinutes: 30,      // look back 30m
      });
      setCode(res.code ?? null);
      if (!res.code) setErr("Timed out without finding a fresh OTP.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed while waiting.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">OTP Wait Demo</h1>

      <label className="block text-sm font-medium">
        Request ID (numeric or UUID)
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          placeholder="101"
        />
      </label>

      <button
        className="rounded px-4 py-2 bg-black text-white disabled:opacity-60"
        disabled={loading}
        onClick={handleWait}
      >
        {loading ? "Waiting…" : "Wait for OTP"}
      </button>

      {code && (
        <div className="p-3 rounded bg-green-50 border border-green-200">
          Got OTP: <b className="font-mono">{code}</b>
        </div>
      )}

      {err && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700">
          {err}
        </div>
      )}

      <p className="text-sm text-gray-600">
        This page polls <code>/api/otp/wait</code> and returns the first fresh OTP matching the request id.
      </p>
    </div>
  );
}
