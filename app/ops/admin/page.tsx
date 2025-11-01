// app/ops/admin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        padding: "2px 6px",
        borderRadius: 6,
      }}
    >
      {children}
    </code>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ color: "#6b7280" }}>{k}</div>
      <div>{v}</div>
    </div>
  );
}

export default function AdminPage() {
  const flags = {
    FLAG_CIRCUIT_BREAKER: process.env.FLAG_CIRCUIT_BREAKER === "1" ? "ON" : "OFF",
    FLAG_DLQ_RETRY: process.env.FLAG_DLQ_RETRY === "1" ? "ON" : "OFF",
    FLAG_DLQ_EXPORT: process.env.FLAG_DLQ_EXPORT === "1" ? "ON" : "OFF",
    FLAG_WEBFORM_ADMIN: process.env.FLAG_WEBFORM_ADMIN === "1" ? "ON" : "OFF",
  };
  const secrets = {
    SECURE_CRON_SECRET: (process.env.SECURE_CRON_SECRET || "").trim() ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE: (process.env.SUPABASE_SERVICE_ROLE || "").trim() ? "SET" : "MISSING",
    NEXT_PUBLIC_SUPABASE_URL: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim() ? "SET" : "MISSING",
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Ops · Admin</h1>
      <p style={{ marginTop: 6, color: "#6b7280" }}>
        Quick view of feature flags, secrets presence, and useful ops links.
      </p>

      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Feature Flags</div>
        <Row k="Circuit Breaker" v={<Mono>{flags.FLAG_CIRCUIT_BREAKER}</Mono>} />
        <Row k="DLQ Retry" v={<Mono>{flags.FLAG_DLQ_RETRY}</Mono>} />
        <Row k="DLQ Export" v={<Mono>{flags.FLAG_DLQ_EXPORT}</Mono>} />
        <Row k="Webform Admin" v={<Mono>{flags.FLAG_WEBFORM_ADMIN}</Mono>} />
      </div>

      <div style={{ height: 12 }} />

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Secrets / Env Presence</div>
        <Row k="SECURE_CRON_SECRET" v={<Mono>{secrets.SECURE_CRON_SECRET}</Mono>} />
        <Row k="SUPABASE_SERVICE_ROLE" v={<Mono>{secrets.SUPABASE_SERVICE_ROLE}</Mono>} />
        <Row k="NEXT_PUBLIC_SUPABASE_URL" v={<Mono>{secrets.NEXT_PUBLIC_SUPABASE_URL}</Mono>} />
      </div>

      <div style={{ height: 12 }} />

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Shortcuts</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a href="/ops/webform/queue" style={btn}>Webform Queue</a>
          <a href="/ops/webform/pulse" style={btn}>Pulse Worker</a>
          <a href="/ops/dlq" style={btn}>DLQ</a>
          <a href="/api/ops/proofs/rollup" style={btn} title="Requires x-secure-cron header (use curl/Postman)">Proof Rollup (API)</a>
          <a href="/api/ops/proofs/receipt" style={btn} title="Requires x-secure-cron header (use curl/Postman)">Receipt Upsert (API)</a>
          <a href="/api/ops/proofs/verify" style={btn} title="Requires x-secure-cron header (use curl/Postman)">Verify (API)</a>
        </div>
        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
          Note: API endpoints above require <Mono>x-secure-cron</Mono> header with your <Mono>SECURE_CRON_SECRET</Mono>.
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  textDecoration: "none",
  border: "1px solid #e5e7eb",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  background: "#fff",
};
