// app/ops/system/page.tsx
import { gatherSystemStatus } from "@/lib/system/health";
import {
  actionTestEmail,
  actionSlaAlertNow,
  actionVerifyAlertNow,
  actionWorkerPulse,
  actionVerifyRecheck,
} from "./actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // always fresh on load

function Badge({ ok }: { ok: boolean }) {
  const bg = ok ? "#10b981" : "#ef4444";
  const txt = ok ? "OK" : "ISSUE";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: "white",
        background: bg,
      }}
    >
      {txt}
    </span>
  );
}

function KVPairs({ obj }: { obj?: Record<string, unknown> }) {
  if (!obj) return null;
  const entries = Object.entries(obj);
  if (!entries.length) return null;
  return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td style={{ padding: "4px 8px", width: 180, color: "#6b7280" }}>{k}</td>
            <td
              style={{
                padding: "4px 8px",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                wordBreak: "break-word",
              }}
            >
              {typeof v === "boolean" ? (v ? "true" : "false") : String(v)}
            </td>
          </tr>
        ))}
        </tbody>
      </table>
  );
}

// Typed so formAction expects void | Promise<void> (keeps TS happy with Server Actions)
function Button(
  props: React.PropsWithChildren<{
    formAction?: (fd: FormData) => void | Promise<void>;
    type?: "button" | "submit";
  }>
) {
  return (
    <button
      type={props.type ?? "submit"}
      formAction={props.formAction}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#111827",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {props.children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        outline: "none",
        minWidth: 280,
      }}
    />
  );
}

export default async function SystemStatusPage() {
  // Admin guard should live in your layout/middleware if needed
  const status = gatherSystemStatus();
  const env = process.env.VERCEL_ENV || "unknown";
  const proj = process.env.VERCEL_PROJECT_PRODUCTION_URL || null;

  // Pre-calc hints for quick eyes
  const emailOk = status.checks.find((c) => c.name === "email.config")?.ok ?? false;
  const cronOk = status.checks.find((c) => c.name === "secure_cron.present")?.ok ?? false;

  // Server action: export KMS-signed bundle
  async function actionExportBundle(fd: FormData) {
    "use server";
    const subjectId = String(fd.get("subjectId") || "").trim();
    if (!subjectId) return;
    const url = `/api/proofs/${encodeURIComponent(subjectId)}/export`;
    redirect(url);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <header
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Ops · System Status</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            Environment: <b>{env}</b>{" "}
            {proj ? (
              <>
                · Project:{" "}
                <a
                  href={`https://${String(proj).replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {proj}
                </a>
              </>
            ) : null}
          </div>
        </div>
        <div>
          <Badge ok={status.ok} />
        </div>
      </header>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <form>
            <Input name="to" placeholder="test recipient (optional)" />
            <Button
              formAction={async (fd) => {
                "use server";
                const to = String(fd.get("to") || "");
                await actionTestEmail(to || undefined);
              }}
            >
              ✉️ Send Test Email
            </Button>
          </form>

          <form>
            <Button
              formAction={async () => {
                "use server";
                await actionSlaAlertNow();
              }}
            >
              📬 Send SLA Alert Digest
            </Button>
          </form>

          <form>
            <Button
              formAction={async () => {
                "use server";
                await actionVerifyAlertNow();
              }}
            >
              🔁 Send Verify Recheck Digest
            </Button>
          </form>

          <form>
            <Button
              formAction={async () => {
                "use server";
                await actionWorkerPulse();
              }}
            >
              ⚙️ Trigger Worker Pulse
            </Button>
          </form>

          <form>
            <Button
              formAction={async () => {
                "use server";
                await actionVerifyRecheck();
              }}
            >
              ✅ Trigger Verify Recheck
            </Button>
          </form>
        </div>

        <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
          {emailOk
            ? "Email config looks good."
            : "Email config incomplete—check EMAIL_FROM / RESEND_API_KEY or EMAIL_DRY_RUN."}
          {" · "}
          {cronOk
            ? "Cron secret present."
            : "SECURE_CRON_SECRET missing—secure quick actions & crons depend on it."}
        </div>
      </section>

      {/* Proof Vault v2: Export & Verify */}
      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Proof Vault v2</h3>

        {/* Export signed bundle (server action redirects to the download) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <form>
            <Input name="subjectId" placeholder="Subject ID for export" />
            <Button formAction={actionExportBundle}>📦 Export KMS-Signed Bundle</Button>
          </form>
        </div>

        {/* Verify a bundle (plain HTML multipart form posting to the API) */}
        <div style={{ marginTop: 12 }}>
          <form action="/api/proofs/verify" method="post" encType="multipart/form-data">
            <input
              type="file"
              name="file"
              accept=".zip,application/zip"
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                outline: "none",
                minWidth: 280,
                marginRight: 8,
              }}
            />
            <Button type="submit">🧪 Verify Uploaded Bundle</Button>
          </form>
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
            Upload the bundle produced by the export to validate signature & contents.
          </div>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            background: "#fcfdfd",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Quick Links</h3>
          <ul style={{ margin: "8px 0 0 16px" }}>
            <li>
              <a href="/ops/webforms">Webform Jobs</a>
            </li>
            <li>
              <a href="/ops/overview">Ops Overview</a>
            </li>
            <li><a href="/ops/proofs">Proof Vault v2 (Export & Verify)</a></li>
            <li>
              <a href="/ops/webforms">Download Packs / Retry / Cancel</a>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
