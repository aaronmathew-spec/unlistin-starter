// app/login/page.tsx
"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setStatus("sending");

    try {
      const r = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error(await r.text());
      setStatus("sent");
    } catch (e: any) {
      setErr(e?.message || "Failed to send link");
      setStatus("error");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "48px auto" }}>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
        />
        <button
          disabled={status === "sending"}
          style={{ width: "100%", padding: 10 }}
        >
          {status === "sending" ? "Sending…" : "Send magic link"}
        </button>
        {status === "sent" && (
          <p style={{ marginTop: 12 }}>Check your inbox for the link.</p>
        )}
        {err && (
          <p style={{ marginTop: 12, color: "crimson" }}>
            Error: {String(err)}
          </p>
        )}
      </form>
    </div>
  );
}
