// app/ops/dispatch/page.tsx
import { actionSendController } from "./actions";

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
      <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{label}</span>
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

function Notice({ ok, err, hint, channel, id }: { ok?: boolean; err?: string; hint?: string; channel?: string; id?: string }) {
  if (ok) {
    return (
      <div style={{ padding: 12, border: "1px solid #10b981", background: "#ecfdf5", borderRadius: 10 }}>
        ✅ Dispatched via <b>{channel}</b> · <code>{id || "OK"}</code>
      </div>
    );
  }
  if (err) {
    return (
      <div style={{ padding: 12, border: "1px solid #ef4444", background: "#fef2f2", borderRadius: 10 }}>
        ❌ Dispatch failed: <b>{err}</b>
        {hint ? <div style={{ color: "#6b7280", marginTop: 4 }}>Hint: {hint}</div> : null}
      </div>
    );
  }
  return null;
}

export default function DispatchConsole({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const ok = searchParams?.ok === "1";
  const err = typeof searchParams?.err === "string" ? searchParams?.err : undefined;
  const hint = typeof searchParams?.hint === "string" ? searchParams?.hint : undefined;
  const channel = typeof searchParams?.channel === "string" ? searchParams?.channel : undefined;
  const id = typeof searchParams?.id === "string" ? searchParams?.id : undefined;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Ops · Dispatch Console</h1>
      <p style={{ color: "#6b7280", marginTop: 6 }}>
        Send a controller request manually using your production dispatcher. No client secrets; all server-side.
      </p>

      <div style={{ marginTop: 12 }}>
        <Notice ok={ok} err={err} hint={hint} channel={channel} id={id} />
      </div>

      <form action={actionSendController} style={{ display: "grid", gap: 14, marginTop: 16 }}>
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
            <Input name="controllerName" placeholder="Truecaller" defaultValue="Truecaller" />
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
        <code>CONTROLLER_TRUECALLER_EMAIL</code>. When email fails and webform is allowed,
        the dispatcher auto-falls back to a webform job. All PII in logs is redacted.
      </div>
    </div>
  );
}
