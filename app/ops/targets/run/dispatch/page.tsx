// app/ops/targets/run/dispatch/page.tsx
// Server-only results viewer for plan fan-out.
// Reads search params, resolves item names via the plan API, calls the cron-guarded
// dispatch API with SECURE_CRON_SECRET header, and renders a results table.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlanItem = {
  key: string;
  name: string;
  preferredChannel?: string | null;
  allowedChannels?: string[] | null;
  category?: string | null;
};

type SubjectInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  subjectId?: string | null;
  handles?: string[] | null;
};

function splitCSV(s?: string | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function mono(v: string) {
  return (
    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {v}
    </span>
  );
}

async function fetchPlanForSubject(s: SubjectInput): Promise<PlanItem[]> {
  const payload = {
    // the API tolerates either 'subject' or 'fullName'
    subject: s.fullName,
    fullName: s.fullName,
    region: s.region ?? "IN",
  };

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const url = base ? `${base}/api/targets/plan` : `/api/targets/plan`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) return [];

  // The API returns { ok, plan } — but also tolerate a bare array for safety.
  let j: any;
  try {
    j = await res.json();
  } catch {
    return [];
  }
  if (Array.isArray(j)) return j as PlanItem[];
  if (j && Array.isArray(j.plan)) return j.plan as PlanItem[];
  return [];
}

function pickItems(all: PlanItem[], keys: string[]): { key: string; name: string }[] {
  const map = new Map(all.map((p) => [p.key, p]));
  return keys.map((k) => {
    const found = map.get(k);
    return { key: k, name: found?.name || k };
  });
}

async function dispatchFanout(args: {
  subject: SubjectInput;
  items: { key: string; name: string }[];
}) {
  const secret = process.env.SECURE_CRON_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      error: "missing_SECURE_CRON_SECRET",
      results: [] as unknown[],
    };
  }

  const payload = {
    region: args.subject.region ?? "IN",
    locale: "en-IN",
    subject: {
      fullName: args.subject.fullName,
      email: args.subject.email ?? null,
      phone: args.subject.phone ?? null,
      subjectId: args.subject.subjectId ?? null,
      handles: args.subject.handles ?? [],
    },
    items: args.items,
  };

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const url = base ? `${base}/api/ops/targets/dispatch` : `/api/ops/targets/dispatch`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-secure-cron": secret,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => null);

  if (!res) {
    return { ok: false, error: "fetch_failed", results: [] as any[] };
  }
  if (!res.ok) {
    let err: string | undefined;
    try {
      const body = (await res.json()) as { error?: string };
      err = body?.error;
    } catch {
      // ignore
    }
    return { ok: false, error: err ?? "dispatch_failed", results: [] as any[] };
  }

  const json = await res.json();
  return json as {
    ok: boolean;
    total: number;
    okCount: number;
    failCount: number;
    region: string;
    locale: string;
    subject: SubjectInput & { handles: string[] };
    results: Array<{
      key: string;
      name: string;
      ok: boolean;
      channel: "webform" | "email" | "noop" | null;
      providerId: string | null;
      error: string | null;
      note: string | null;
      idempotent: string | null;
      hint: string | null;
    }>;
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Read subject & keys from query string (sent by /ops/targets/run form)
  const fullName = String(searchParams.fullName || "").trim();
  if (!fullName) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>Ops · Dispatch Results</h1>
        <p style={{ color: "#6b7280" }}>
          Missing <code>fullName</code>. Please go back and generate a plan.
        </p>
        <a
          href="/ops/targets"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          ← Back to Matrix
        </a>
      </div>
    );
  }

  const email = String(searchParams.email || "").trim() || null;
  const phone = String(searchParams.phone || "").trim() || null;
  const region = (String(searchParams.region || "IN").trim() || "IN").toUpperCase();
  const subjectId = String(searchParams.subjectId || "").trim() || null;
  const handles = splitCSV(String(searchParams.handles || ""));
  const keysCSV = String(searchParams.keys || "").trim();
  const keys = splitCSV(keysCSV);

  const subject: SubjectInput = { fullName, email, phone, region, subjectId, handles };

  // 1) Pull plan to get canonical names for keys we’re dispatching
  const plan = await fetchPlanForSubject(subject);
  const items = keys.length ? pickItems(plan, keys) : plan.map((p) => ({ key: p.key, name: p.name }));

  // 2) Dispatch via cron-guarded API (server-to-server)
  const result = await dispatchFanout({ subject, items });

  // 3) Render
  const summary = (result as any)?.ok
    ? {
        ok: true,
        total: (result as any).total,
        okCount: (result as any).okCount,
        failCount: (result as any).failCount,
        region: (result as any).region,
        locale: (result as any).locale,
      }
    : { ok: false, error: (result as any)?.error || "unknown_error" };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Dispatch Results</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Server-side fan-out executed via cron-guarded API. Shows per-controller outcome for this subject.
          </p>
        </div>
        <a
          href={`/ops/targets/run?fullName=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email ?? "")}&phone=${encodeURIComponent(phone ?? "")}&region=${encodeURIComponent(region)}&subjectId=${encodeURIComponent(subjectId ?? "")}&handles=${encodeURIComponent(handles.join(","))}`}
          style={{ textDecoration: "none", border: "1px solid #e5e7eb", padding: "8px 12px", borderRadius: 8, fontWeight: 600 }}
        >
          ← Back to Plan
        </a>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Subject</div>
            <div style={{ marginTop: 2 }}>
              {mono(fullName)} {email ? <>· {mono(email)}</> : null} {phone ? <>· {mono(phone)}</> : null}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Context</div>
            <div style={{ marginTop: 2 }}>
              {(summary as any).ok ? (
                <>
                  Region {mono((summary as any).region)} · Locale {mono((summary as any).locale)} · Total{" "}
                  {mono(String((summary as any).total))}
                </>
              ) : (
                <span style={{ color: "#b91c1c" }}>Error: {(summary as any).error}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
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
          Results
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 720, borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ textAlign: "left", background: "#fafafa" }}>
              <tr>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Controller</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Key</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>OK</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Channel</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Provider ID</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Note</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Error</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Idempotent</th>
              </tr>
            </thead>
            <tbody>
              {(result as any)?.ok && Array.isArray((result as any)?.results) && (result as any).results.length ? (
                (result as any).results.map((r: any) => (
                  <tr key={r.key} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>{r.name}</td>
                    <td style={{ padding: 12 }}>{mono(r.key)}</td>
                    <td style={{ padding: 12 }}>{r.ok ? "✓" : "✗"}</td>
                    <td style={{ padding: 12 }}>{r.channel || "—"}</td>
                    <td style={{ padding: 12 }}>{r.providerId ? mono(String(r.providerId)) : "—"}</td>
                    <td style={{ padding: 12 }}>{r.note || "—"}</td>
                    <td style={{ padding: 12, color: r.error ? "#b91c1c" : undefined }}>{r.error || "—"}</td>
                    <td style={{ padding: 12 }}>{r.idempotent || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                    {(result as any)?.ok ? "No items." : "No results due to error."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick guidance */}
      <p style={{ color: "#6b7280", marginTop: 12 }}>
        If any items failed due to enqueue errors, check <a href="/ops/dlq">DLQ</a> to re-try.
      </p>
    </div>
  );
}
