// app/ops/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type State = "idle" | "verifying" | "ok" | "error";

export default function LoginClient() {
  const sp = useSearchParams();
  const router = useRouter();

  // read optional ?token= and ?next=
  const urlToken = useMemo(() => sp.get("token")?.trim() || "", [sp]);
  const next = useMemo(() => sp.get("next")?.trim() || "/ops/health", [sp]);

  // allow manual entry; seed with URL token if present
  const [token, setToken] = useState<string>(urlToken);
  const [state, setState] = useState<State>("idle");
  const [err, setErr] = useState<string | null>(null);

  // keep state in sync if the url token changes (e.g., user pastes a link)
  useEffect(() => {
    if (urlToken && urlToken !== token) setToken(urlToken);
  }, [urlToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token) {
      setErr("Please paste a token.");
      return;
    }
    setState("verifying");
    try {
      const res = await fetch("/api/ops/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setState("error");
        setErr(j?.error || "Login failed");
      } else {
        setState("ok");
        router.replace(next);
      }
    } catch (e: any) {
      setState("error");
      setErr(String(e?.message || e));
    }
  }

  const redacted =
    token.length > 8 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token;

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
      }}
    >
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Admin token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste OPS_DASHBOARD_TOKEN or keep the ?token= in URL"
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
          <div
            style={{
              padding: 10,
              border: "1px solid #f99",
              background: "#fee",
              borderRadius: 8,
            }}
          >
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={state === "verifying"}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "white",
          }}
        >
          {state === "verifying" ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ opacity: 0.7, fontSize: 13 }}>
          You’ll be redirected to: <code>{next}</code>
        </div>

        <div style={{ color: "#666", fontSize: 13 }}>
          <p style={{ margin: 0 }}>
            URL token detected:&nbsp;
            <code>{token ? redacted : "(none)"}</code>
          </p>
          <p style={{ margin: 0 }}>
            Dev tip: set <code>NEXT_PUBLIC_SECURE_CRON_PREVIEW</code> in{" "}
            <code>.env.local</code> to call protected Ops APIs from the browser
            during development (those that check the <code>x-secure-cron</code>{" "}
            header).
          </p>
        </div>
      </form>
    </section>
  );
}
