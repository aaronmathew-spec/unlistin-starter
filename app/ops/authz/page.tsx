// app/ops/authz/page.tsx
// Server-rendered tool to generate & preview Authorization Manifests (no client JS).

import { createAuthorizationManifest, type Permission } from "@/src/lib/authz/manifest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SP = Record<string, string | string[] | undefined>;

function get(sp: SP, key: string) {
  return String(sp[key] || "").trim();
}

function splitCSV(s?: string) {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function mono(v: string) {
  return <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{v}</span>;
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const fullName = get(searchParams, "fullName");
  const email = get(searchParams, "email") || null;
  const phone = get(searchParams, "phone") || null;
  const region = (get(searchParams, "region") || "IN").toUpperCase();
  const subjectId = get(searchParams, "subjectId") || null;
  const handles = splitCSV(get(searchParams, "handles"));
  const perms = splitCSV(get(searchParams, "permissions")).map((p) => p as Permission);
  const loaUrl = get(searchParams, "loaUrl") || null;
  const idUrl = get(searchParams, "idUrl") || null;
  const expiresDaysStr = get(searchParams, "expiresInDays");
  const expiresInDays = expiresDaysStr ? Number(expiresDaysStr) : null;

  const shouldBuild = !!fullName && !!region && perms.length > 0;

  const manifest = shouldBuild
    ? createAuthorizationManifest({
        subject: {
          id: subjectId,
          fullName,
          email,
          phone,
          handles: handles.length ? handles : null,
        },
        region,
        permissions: perms,
        evidence: [
          ...(loaUrl ? [{ kind: "authority_letter" as const, url: loaUrl }] : []),
          ...(idUrl ? [{ kind: "id_government" as const, url: idUrl }] : []),
        ],
        expiresInDays: Number.isFinite(expiresInDays ?? NaN) ? Number(expiresInDays) : null,
        agent: null,
      })
    : null;

  const jsonStr = manifest ? JSON.stringify(manifest, null, 2) : "";

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Authorization Manifest</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Generate a signed (or unsigned) authorization manifest to attach to controller requests, proving agent authority.
          </p>
        </div>
        <a
          href="/ops"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          ← Back to Ops
        </a>
      </div>

      {/* GET form to avoid client JS; server renders the result below */}
      <form method="GET" style={{ marginTop: 16 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            background: "white",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Full Name *</label>
            <input name="fullName" required defaultValue={fullName} placeholder="Aarav Shah"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Email</label>
            <input name="email" defaultValue={email ?? ""} placeholder="aarav@example.com"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Phone</label>
            <input name="phone" defaultValue={phone ?? ""} placeholder="+91-98xxxxxxx"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Region (ISO)</label>
            <input name="region" defaultValue={region || "IN"} placeholder="IN"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Subject ID</label>
            <input name="subjectId" defaultValue={subjectId ?? ""} placeholder="user_123"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Handles / Links (CSV)</label>
            <input name="handles" defaultValue={handles.join(", ")} placeholder="instagram:aarav, x:aarav"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Permissions (CSV) *</label>
            <input
              name="permissions"
              required
              defaultValue={perms.join(", ")}
              placeholder="erasure, access"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>LoA URL (optional)</label>
            <input name="loaUrl" defaultValue={loaUrl ?? ""} placeholder="https://files/loa.pdf"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>ID Doc URL (optional)</label>
            <input name="idUrl" defaultValue={idUrl ?? ""} placeholder="https://files/id.pdf"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Expires In (days)</label>
            <input type="number" min={1} name="expiresInDays" defaultValue={expiresInDays ?? ""}
              placeholder="30" style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div style={{ textAlign: "right" }}>
            <button
              type="submit"
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "white",
                fontWeight: 700,
              }}
            >
              Generate Manifest
            </button>
          </div>
        </div>
      </form>

      {/* Output */}
      {shouldBuild ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Subject</div>
                <div style={{ marginTop: 2 }}>
                  {mono(fullName)} {email ? <>· {mono(email)}</> : null} {phone ? <>· {mono(phone)}</> : null}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Region · Permissions</div>
                <div style={{ marginTop: 2 }}>{mono(region)} · {mono(perms.join(", "))}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 12, background: "white", overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 600 }}>
              Manifest JSON
            </div>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                background: "#f9fafb",
                padding: 12,
                borderRadius: 0,
              }}
            >
{jsonStr}
            </pre>
          </div>

          <div style={{ marginTop: 8, textAlign: "right" }}>
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(jsonStr)}`}
              download={`authz_${fullName.replace(/\s+/g, "_")}_${region}.json`}
              style={{
                textDecoration: "none",
                border: "1px solid #e5e7eb",
                padding: "8px 12px",
                borderRadius: 8,
                fontWeight: 600,
                background: "white",
              }}
            >
              Download JSON
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
