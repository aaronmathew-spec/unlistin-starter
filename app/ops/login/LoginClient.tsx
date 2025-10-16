// app/ops/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type State = "idle" | "verifying" | "ok" | "error";

/**
 * Minimal client-side helper that reads ?token=... and calls a server route
 * you already protect with x-secure-cron (or simply shows the token and hints).
 * This avoids SSR hooks issues and keeps the page CSR-only.
 *
 * If you already have an API route to set an ops session cookie, the POST below
 * will work; otherwise it will just show the token so you can use it in headers.
 */
export default function LoginClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const token = useMemo(() => sp.get("token")?.trim() || "", [sp]);

  useEffect(() => {
    // If you have an API route to establish a session, call it here.
    // Otherwise, we just remain on this page and show instructions.
    const PREVIEW = process.env.NEXT_PUBLIC_SECURE_CRON_PREVIEW?.trim() || "";

    async function tryLogin() {
      if (!token) return;

      // If you already wired an ops login API, uncomment and point to it.
      // setState("verifying");
      // const res = await fetch("/api/ops/session/login", {
      //   method: "POST",
      //   headers: {
      //     "content-type": "application/json",
      //     "x-secure-cron": PREVIEW, // dev helper; in prod you’ll use server-only checks
      //   },
      //   body: JSON.stringify({ token }),
      // });
      // if (res.ok) {
      //   setState("ok");
      //   router.replace("/ops/overview");
      // } else {
      //   setState("error");
      // }

      // For now, don’t redirect automatically; leave token visible to copy.
      setState("idle");
    }

    void tryLogin();
  }, [token, router]);

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
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#666" }}>
            Query token
          </label>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "8px 10px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              background: "#fafafa",
            }}
          >
            {token ? redacted : "(none)"}
          </div>
        </div>

        <div style={{ fontSize: 14, color: "#444" }}>
          {state === "verifying" && "Verifying…"}
          {state === "ok" && "Verified. Redirecting…"}
          {state === "error" && "Invalid/expired token."}
          {state === "idle" &&
            (token
              ? "Token detected in URL. If you wired /api/ops/session/login, uncomment the fetch in this component."
              : "Append ?token=YOUR_TOKEN to the URL or paste a bookmarked link.")}
        </div>

        <div style={{ color: "#666", fontSize: 13 }}>
          <p style={{ margin: 0 }}>
            Local dev tip: set{" "}
            <code>NEXT_PUBLIC_SECURE_CRON_PREVIEW</code> in <code>.env.local</code>{" "}
            so protected Ops APIs that check{" "}
            <code>x-secure-cron</code> can be called from the browser during
            development.
          </p>
        </div>
      </div>
    </section>
  );
}
