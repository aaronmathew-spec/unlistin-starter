// app/ops/webform/pulse/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function pulse(): Promise<{ ok: boolean; status: number; body: any }> {
  const url =
    (process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "") +
    "/api/ops/webform/worker";
  const secret = process.env.SECURE_CRON_SECRET?.trim();

  if (!secret) {
    return { ok: false, status: 500, body: { error: "SECURE_CRON_SECRET not configured" } };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "x-secure-cron": secret, "content-type": "application/json" },
    cache: "no-store",
  }).catch((e) => ({ ok: false, status: 500, json: async () => ({ error: String(e) }) } as any));

  const body = typeof (res as any).json === "function" ? await (res as any).json() : {};
  return { ok: !!res.ok, status: (res as any).status ?? 500, body };
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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

export default async function Page() {
  const result = await pulse();
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Ops · Webform Worker Pulse</h1>
      <p style={{ color: "#6b7280", marginTop: 6 }}>
        Triggers a single worker pulse server-side with <Mono>x-secure-cron</Mono>.
      </p>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          padding: 16,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          Status:{" "}
          <span style={{ fontWeight: 700, color: result.ok ? "#065f46" : "#991b1b" }}>
            {result.ok ? "OK" : "ERROR"}
          </span>{" "}
          <Mono>{String(result.status)}</Mono>
        </div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 12,
            background: "#0b1020",
            color: "#e5e7eb",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111827",
            maxHeight: 480,
            overflow: "auto",
          }}
        >
{JSON.stringify(result.body, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
        Tip: open <Mono>/ops/dlq</Mono> to see if failed jobs hit the queue after this pulse.
      </div>
    </div>
  );
}
