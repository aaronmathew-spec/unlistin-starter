// app/ops/login/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function OpsLoginPage() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sp = useSearchParams();
  const router = useRouter();
  const next = sp.get("next") || "/ops/health";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ops/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(j?.error || "Login failed");
      } else {
        router.replace(next);
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 420, margin: "10vh auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Ops · Login</h1>
      <p style={{ opacity: 0.8, marginBottom: 14 }}>
        Enter the one-time admin token to access Ops dashboards.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Admin token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste OPS_DASHBOARD_TOKEN"
            required
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              outline: "none",
            }}
          />
        </label>

        {err && (
          <div style={{ padding: 10, border: "1px solid #f99", background: "#fee", borderRadius: 8 }}>
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333", background: "white" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ opacity: 0.7, fontSize: 13 }}>
          You’ll be redirected to: <code>{next}</code>
        </div>
      </form>
    </main>
  );
}
