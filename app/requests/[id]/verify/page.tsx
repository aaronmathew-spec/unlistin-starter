"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { waitForOtp } from "@/lib/otp";

export default function VerifyRequestOtpPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runWait() {
    setLoading(true);
    setErr(null);
    setCode(null);
    try {
      const res = await waitForOtp({
        requestId,
        withinMinutes: 60,
        timeoutMs: 20000,
        pollIntervalMs: 2000,
      });
      setCode(res.code);
      if (!res.code) setErr("Timed out waiting for OTP. Try again or resend.");
    } catch (e: any) {
      setErr(e?.message ?? "wait failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runWait();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Verify Request</h1>
      <div className="text-sm text-gray-600">Request ID: <span className="font-mono">{requestId}</span></div>

      <button
        className="rounded px-4 py-2 bg-black text-white disabled:opacity-60"
        disabled={loading}
        onClick={runWait}
      >
        {loading ? "Waiting…" : "Wait for OTP again"}
      </button>

      {code && (
        <div className="p-3 rounded bg-green-50 border border-green-200">
          OTP detected: <b className="font-mono">{code}</b>
        </div>
      )}

      {err && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700">{err}</div>
      )}

      <p className="text-sm text-gray-600">
        This page polls <code>/api/otp/wait</code> for a recent OTP matching this request id (numeric or UUID).
      </p>
    </div>
  );
}
