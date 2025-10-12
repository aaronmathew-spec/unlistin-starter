"use client";

import { useState } from "react";

export default function VerifyButton({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ within_minutes: 60 })
      });
      const j = await res.json();
      if (j?.ok && j?.verified) {
        setMsg(`Verified with OTP ${j.code}`);
      } else {
        setMsg("No fresh OTP found.");
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Verify failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="px-3 py-2 rounded bg-black text-white disabled:opacity-60"
      >
        {loading ? "Verifying…" : "Verify now"}
      </button>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}
    </div>
  );
}
