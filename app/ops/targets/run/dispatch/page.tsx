// app/ops/targets/run/dispatch/page.tsx
// Server-only proxy page that performs the actual dispatch (injects x-secure-cron)
// and renders results (no client JS).

export const dynamic = "force-dynamic";

type ResultRow = {
  controllerKey?: string;
  ok: boolean;
  dryRun?: boolean;
  channel?: string;
  providerId?: string | null;
  idempotent?: "new" | "deduped";
  error?: string | null;
  note?: string | null;
};

function mono(v: string) {
  return (
    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {v}
    </span>
  );
}

function splitCSV(s?: string | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const fullName = String(searchParams.fullName || "").trim();
  const email = String(searchParams.email || "").trim() || null;
  const phone = String(searchParams.phone || "").trim() || null;
  const region = (String(searchParams.region || "IN").trim() || "IN").toUpperCase();
  const subjectId = String(searchParams.subjectId || "").trim() || null;
  const handles = splitCSV(String(searchParams.handles || ""));
  const keys = splitCSV(String(searchParams.keys || ""));

  const secret = process.env.SECURE_CRON_SECRET || "";
  const payload = {
    region,
    locale: "en-IN",
    subject: {
      fullName,
      email,
      phone,
      subjectId,
      handles,
    },
    items: keys.map((k) => ({ key: k, name: k })),
  };

  let status = 200;
  let api: any = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/ops/targets/dispatch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-secure-cron": secret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    status = res.status;
    api = await res.json().catch(async () => ({ text: await res.text() }));
  } catch (e: any) {
    status = 500;
    api = { ok: false, error: String(e?.message || e) };
  }

  const results: ResultRow[] = Array.isArray(api?.results) ? api.results : [];
  const flagEnabled: boolean = !!api?.flagEnabled;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Dispatch Results</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Flag <code>FLAG_PLAN_DISPATCH_ENABLED</code>: {flagEnabled ? "ON (live enqueue)" : "OFF (dry-run)"} · HTTP {status}
          </p>
        </div>
        <a
          href="/ops/targets/run"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          ← Back to Run
        </a>
      </div>

      {/* Subject */}
      <div
        style={{
          marginTop: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          padding: 12,
        }}
      >
        <div style={{ fontSize: 13, color: "#6b7280" }}>Subject</div>
        <div style={{ marginTop: 4 }}>
          {mono(fullName)} {email ? <>· {mono(email)}</> : null} {phone ? <>· {mono(phone)}</> : null} · Region {mono(region)}
        </div>
      </div>

      {/* Results table */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          background: "white",
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #e5e7eb",
            background: "#f9fafb",
            fontWeight: 600,
          }}
        >
          Results ({results.length})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 720,
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <thead style={{ textAlign: "left", background: "#fafafa" }}>
              <tr>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Controller</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>OK</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>DryRun</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Channel</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>ProviderId</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Idempotent</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Error</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {results.length ? (
                results.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>{r.controllerKey ?? "—"}</td>
                    <td style={{ padding: 12 }}>{String(!!r.ok)}</td>
                    <td style={{ padding: 12 }}>{r.dryRun ? "true" : "false"}</td>
                    <td style={{ padding: 12 }}>{r.channel ?? "—"}</td>
                    <td style={{ padding: 12 }}>{r.providerId ?? "—"}</td>
                    <td style={{ padding: 12 }}>{r.idempotent ?? "—"}</td>
                    <td style={{ padding: 12 }}>{r.error ?? "—"}</td>
                    <td style={{ padding: 12 }}>{r.note ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                    No results payload.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw payload (debug) */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Raw Response</div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 12,
            background: "#f9fafb",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
{JSON.stringify(api, null, 2)}
        </pre>
      </div>
    </div>
  );
}
