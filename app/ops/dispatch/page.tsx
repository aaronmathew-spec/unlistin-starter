// app/ops/dispatch/page.tsx
import { actionSendController } from "./actions";
import { listDispatchLog } from "@/lib/dispatch/query";

export const dynamic = "force-dynamic";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        padding: "10px 12px",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        outline: "none",
        fontSize: 14,
      }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        padding: "10px 12px",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        outline: "none",
        fontSize: 14,
        background: "white",
      }}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #111827",
        background: "#111827",
        color: "white",
        fontWeight: 700,
        cursor: "pointer",
      }}
    />
  );
}

function Notice({
  ok,
  err,
  hint,
  channel,
  id,
}: {
  ok?: boolean;
  err?: string;
  hint?: string;
  channel?: string;
  id?: string;
}) {
  if (ok) {
    return (
      <div
        style={{
          padding: 12,
          border: "1px solid #10b981",
          background: "#ecfdf5",
          borderRadius: 10,
        }}
      >
        ✅ Dispatched via <b>{channel}</b> · <code>{id || "OK"}</code>
      </div>
    );
  }
  if (err) {
    return (
      <div
        style={{
          padding: 12,
          border: "1px solid #ef4444",
          background: "#fef2f2",
          borderRadius: 10,
        }}
      >
        ❌ Dispatch failed: <b>{err}</b>
        {hint ? (
          <div style={{ color: "#6b7280", marginTop: 4 }}>Hint: {hint}</div>
        ) : null}
      </div>
    );
  }
  return null;
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

// Keep this type aligned with your lib/dispatch/query return shape
type DispatchRow = Awaited<ReturnType<typeof listDispatchLog>>[number];

function groupLatest(rows: DispatchRow[]) {
  const byKey = new Map<string, DispatchRow>();
  for (const r of rows) {
    const prev = byKey.get(r.dedupe_key);
    if (!prev) {
      byKey.set(r.dedupe_key, r);
    } else if (
      new Date(r.created_at).getTime() > new Date(prev.created_at).getTime()
    ) {
      byKey.set(r.dedupe_key, r);
    }
  }
  return Array.from(byKey.values());
}

function getFirstParam(
  v: string | string[] | undefined
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
}

export default async function DispatchConsole({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const ok = getFirstParam(searchParams?.ok) === "1";
  const err = getFirstParam(searchParams?.err);
  const hint = getFirstParam(searchParams?.hint);
  const channel = getFirstParam(searchParams?.channel);
  const id = getFirstParam(searchParams?.id);

  // Fetch recent dispatch audit (server-side)
  // We keep the limit moderate for perf; the UI will show latest per dedupe.
  let latestPerRequest: DispatchRow[] = [];
  try {
    const recent = await listDispatchLog(500);
    latestPerRequest = groupLatest(recent);
  } catch {
    latestPerRequest = [];
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Ops · Dispatch Console</h1>
      <p style={{ color: "#6b7280", marginTop: 6 }}>
        Send a controller request manually using your production dispatcher. No
        client secrets; all server-side.
      </p>

      <div style={{ marginTop: 12 }}>
        <Notice ok={ok} err={err} hint={hint} channel={channel} id={id} />
      </div>

      <form
        action={actionSendController}
        style={{ display: "grid", gap: 14, marginTop: 16 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <Field label="Controller Key">
            <Select name="controllerKey" defaultValue="truecaller" required>
              <option value="truecaller">truecaller</option>
              <option value="naukri">naukri</option>
              <option value="olx">olx</option>
              <option value="foundit">foundit</option>
              <option value="shine">shine</option>
              <option value="timesjobs">timesjobs</option>
            </Select>
          </Field>

          <Field label="Controller Name">
            <Input
              name="controllerName"
              placeholder="Truecaller"
              defaultValue="Truecaller"
            />
          </Field>

          <Field label="Locale">
            <Select name="locale" defaultValue="en">
              <option value="en">English (en)</option>
              <option value="hi">Hindi (hi)</option>
            </Select>
          </Field>

          <Field label="Preferred Channel (override)">
            <Select name="preferred" defaultValue="">
              <option value="">(auto from templates/policy)</option>
              <option value="webform">webform</option>
              <option value="email">email</option>
              <option value="api">api</option>
            </Select>
          </Field>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <Field label="Subject Name">
            <Input name="name" placeholder="Rahul Sharma" />
          </Field>
          <Field label="Subject Email">
            <Input name="email" placeholder="rahul@example.com" />
          </Field>
          <Field label="Subject Phone">
            <Input name="phone" placeholder="+91 98xxxx1234" />
          </Field>
        </div>

        <Field label="Form URL (optional, seeds worker if webform)">
          <Input
            name="formUrl"
            placeholder="https://www.truecaller.com/privacy-center/request/unlist"
          />
        </Field>

        <div>
          <Button type="submit">Dispatch</Button>
        </div>
      </form>

      <div style={{ marginTop: 18, color: "#6b7280", fontSize: 13 }}>
        Tip: set per-controller desk emails via env like{" "}
        <code>CONTROLLER_TRUECALLER_EMAIL</code>. When email fails and webform
        is allowed, the dispatcher auto-falls back to a webform job. All PII in
        logs is redacted.
      </div>

      {/* ---- Latest status per request (delivery + outcomes) ---- */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Latest status per request</h2>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 720,
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead style={{ background: "#f9fafb", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    When
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Controller
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Subject
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Channel
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Provider ID
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Note
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {latestPerRequest.map((r) => (
                  <tr
                    key={`${r.dedupe_key}-${r.id}`}
                    style={{ borderTop: "1px solid #e5e7eb" }}
                  >
                    <td style={{ padding: 12 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 12 }}>{r.controller_key}</td>
                    <td style={{ padding: 12 }}>
                      {[r.subject_name, r.subject_email, r.subject_phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td style={{ padding: 12 }}>{r.channel || "-"}</td>
                    <td style={{ padding: 12, fontFamily: "monospace" }}>
                      {r.provider_id || "-"}
                    </td>
                    <td style={{ padding: 12 }}>{r.note || "-"}</td>
                    <td style={{ padding: 12 }}>
                      <Badge ok={!!r.ok} />
                    </td>
                  </tr>
                ))}
                {latestPerRequest.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      No dispatches yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* ---- /Latest status ---- */}
    </div>
  );
}
