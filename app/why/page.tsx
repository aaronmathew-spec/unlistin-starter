// app/why/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#6b7280" }}>{children}</div>
    </div>
  );
}

export default function Why() {
  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <a href="/" style={{ textDecoration: "none", color: "#111827" }}>← Home</a>
      <h1 style={{ marginTop: 10, marginBottom: 6 }}>Why UnlistIN</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        You need clear outcomes and verifiable evidence — not empty promises. Our system is built to prove action.
      </p>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Card title="Proof-backed">
          Every request produces artifacts (HTML + screenshots) you can verify and keep for records.
        </Card>
        <Card title="Safe by default">
          Human-supervised AI. Strict least-privilege, audit trails, and a kill-switch for automations.
        </Card>
        <Card title="India-first → Global">
          We start with DPDP compliance and extend to US/EU templates as you expand your coverage.
        </Card>
        <Card title="Transparent pricing">
          Clear tiers and simple billing. No surprises.
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <a
          href="/start"
          style={{
            textDecoration: "none",
            border: "1px solid #111827",
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 700,
            background: "#111827",
            color: "white",
          }}
        >
          Start a removal
        </a>
      </div>
    </main>
  );
}
