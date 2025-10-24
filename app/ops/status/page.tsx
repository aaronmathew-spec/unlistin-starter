// app/ops/status/page.tsx
export const dynamic = "force-dynamic";

type Health = {
  ok: boolean;
  service: string;
  time: string;
  timezone: string;
  uptime_s: number;
  node: string;
  features: Record<string, boolean>;
  env: {
    NEXT_PUBLIC_SUPABASE_URL: boolean;
    SUPABASE_SERVICE_ROLE: boolean;
    SECURE_CRON_SECRET: boolean;
    SIGNING_BACKEND: string;
  };
};

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 800, fontSize: 24 }}>{value}</div>
      {sub ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{sub}</div>
      ) : null}
    </div>
  );
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: ok ? "#065f46" : "#991b1b",
        background: ok ? "#d1fae5" : "#fee2e2",
        border: `1px solid ${ok ? "#10b981" : "#ef4444"}`,
      }}
    >
      {ok ? "OK" : "ERROR"}
    </span>
  );
}

export default async function OpsStatusPage() {
  let h: Health | null = null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/ops/health`, {
      cache: "no-store",
    });
    h = (await r.json()) as Health;
  } catch {
    h = null;
  }

  const uptime = h ? `${Math.floor(h.uptime_s / 3600)}h ${Math.floor((h.uptime_s % 3600) / 60)}m` : "—";

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Status</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Lightweight health — runtime info, feature flags and critical env presence.
          </p>
        </div>
        <a
          href="/ops/dispatch"
          style={{ textDecoration: "none", border: "1px solid #e5e7eb", padding: "8px 12px", borderRadius: 8, fontWeight: 600 }}
        >
          ← Dispatch
        </a>
      </div>

      {/* Topline */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <Stat label="Service time" value={h?.time || "—"} sub={h?.timezone || ""} />
        <Stat label="Uptime" value={uptime} />
        <Stat label="Node" value={h?.node || "—"} />
        <Stat label="Signing backend" value={h?.env?.SIGNING_BACKEND || "—"} />
      </div>

      {/* Features */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          background: "white",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 600 }}>
          Features
        </div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {Object.entries(h?.features || {}).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{k}</div>
              <Badge ok={!!v} />
            </div>
          ))}
          {!h && <div style={{ color: "#6b7280" }}>Health endpoint unavailable.</div>}
        </div>
      </div>

      {/* Env presence (redacted) */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          background: "white",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 600 }}>
          Environment (presence only)
        </div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>NEXT_PUBLIC_SUPABASE_URL</div>
            <div style={{ marginTop: 4 }}><Badge ok={!!h?.env?.NEXT_PUBLIC_SUPABASE_URL} /></div>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>SUPABASE_SERVICE_ROLE</div>
            <div style={{ marginTop: 4 }}><Badge ok={!!h?.env?.SUPABASE_SERVICE_ROLE} /></div>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>SECURE_CRON_SECRET</div>
            <div style={{ marginTop: 4 }}><Badge ok={!!h?.env?.SECURE_CRON_SECRET} /></div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
        Tip: wire deeper checks (Supabase ping, queue depth, browser farm status) behind feature flags here later.
      </div>
    </div>
  );
}
