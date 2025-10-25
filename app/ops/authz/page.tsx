// app/ops/authz/page.tsx
// Server-rendered tool to generate & preview Authorization Manifests (no client JS).
// Defensive: works with different authz builder export shapes in your repo.

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
  return (
    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {v}
    </span>
  );
}

/** Resolve a manifest builder from the authz module, regardless of export name/shape. */
async function resolveAuthzBuilder() {
  // Import once on the server — this is a server component.
  // We deliberately avoid type imports to stay compatible with whichever module shape exists.
  const mod: any = await import("@/src/lib/authz/manifest").catch(() => ({}));

  // Prefer explicit creators
  if (typeof mod.createAuthorizationManifest === "function") {
    return async (args: any) => mod.createAuthorizationManifest(args);
  }
  if (typeof mod.buildAuthorizationManifest === "function") {
    return async (args: any) => mod.buildAuthorizationManifest(args);
  }

  // Some versions export a *bundle* creator that returns { manifest, integrity, ... }.
  // We’ll unwrap manifest if present.
  if (typeof mod.createAuthorizationBundle === "function") {
    return async (args: any) => {
      const bundle = await mod.createAuthorizationBundle(args);
      return bundle?.manifest ?? bundle;
    };
  }

  // Default export (function)
  if (typeof mod.default === "function") {
    return async (args: any) => mod.default(args);
  }

  // No compatible builder found
  throw new Error(
    "authz_builder_missing: expected one of createAuthorizationManifest, buildAuthorizationManifest, createAuthorizationBundle, or default export."
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const fullName = get(searchParams, "fullName");
  const email = get(searchParams, "email") || null;
  const phone = get(searchParams, "phone") || null;
  const region = (get(searchParams, "region") || "IN").toUpperCase();
  const subjectId = get(searchParams, "subjectId") || null;
  const handles = splitCSV(get(searchParams, "handles"));
  // We keep permissions as plain strings to avoid type import mismatches
  const perms = splitCSV(get(searchParams, "permissions"));
  const loaUrl = get(searchParams, "loaUrl") || null;
  const idUrl = get(searchParams, "idUrl") || null;
  const expiresDaysStr = get(searchParams, "expiresInDays");
  const expiresInDays = expiresDaysStr ? Number(expiresDaysStr) : null;

  const shouldBuild = !!fullName && !!region && perms.length > 0;

  let manifest: any = null;
  let errorMsg: string | null = null;

  if (shouldBuild) {
    try {
      const build = await resolveAuthzBuilder();
      manifest = await build({
        subject: {
          id: subjectId,
          fullName,
          email,
          phone,
          handles: handles.length ? handles : null,
        },
        region,
        permissions: perms, // string[]
        evidence: [
          ...(loaUrl ? [{ kind: "authority_letter" as const, url: loaUrl }] : []),
          ...(idUrl ? [{ kind: "id_government" as const, url: idUrl }] : []),
        ],
        expiresInDays: Number.isFinite(expiresInDays ?? NaN) ? Number(expiresInDays) : null,
        agent: null,
      });

      // Some builders may return a "bundle" directly; if so, unwrap
      if (manifest && typeof manifest === "object" && "manifest" in manifest && !("version" in manifest)) {
        manifest = (manifest as any).manifest;
      }
    } catch (e: any) {
      errorMsg = String(e?.message || e);
      manifest = null;
    }
  }

  const jsonStr = manifest ? JSON.stringify(manifest, null, 2) : "";
  const dataUrl = jsonStr ? `data:application/json;charset=utf-8,${encodeURIComponent(jsonStr)}` : "";

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Authorization Manifest</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Generate an authorization manifest to attach to controller requests, proving agent authority.
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
            <input
              name="fullName"
              required
              defaultValue={fullName}
              placeholder="Aarav Shah"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Email</label>
            <input
              name="email"
              defaultValue={email ?? ""}
              placeholder="aarav@example.com"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Phone</label>
            <input
              name="phone"
              defaultValue={phone ?? ""}
              placeholder="+91-98xxxxxxx"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Region (ISO)</label>
            <input
              name="region"
              defaultValue={region || "IN"}
              placeholder="IN"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Subject ID</label>
            <input
              name="subjectId"
              defaultValue={subjectId ?? ""}
              placeholder="user_123"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Handles / Links (CSV)</label>
            <input
              name="handles"
              defaultValue={handles.join(", ")}
              placeholder="instagram:aarav, x:aarav"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
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
            <input
              name="loaUrl"
              defaultValue={loaUrl ?? ""}
              placeholder="https://files/loa.pdf"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>ID Doc URL (optional)</label>
            <input
              name="idUrl"
              defaultValue={idUrl ?? ""}
              placeholder="https://files/id.pdf"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Expires In (days)</label>
            <input
              type="number"
              min={1}
              name="expiresInDays"
              defaultValue={Number.isFinite(expiresInDays ?? NaN) ? String(expiresInDays) : ""}
              placeholder="30"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
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
          {/* error block */}
          {errorMsg ? (
            <div
              style={{
                border: "1px solid #f59e0b",
                background: "#fff7ed",
                color: "#92400e",
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Build error</div>
              <div style={{ fontSize: 13 }}>{errorMsg}</div>
            </div>
          ) : null}

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
                <div style={{ marginTop: 2 }}>
                  {mono(region)} · {mono(perms.join(", "))}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
              overflow: "hidden",
            }}
          >
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

          {!errorMsg && jsonStr ? (
            <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <a
                href={dataUrl}
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
              <a
                href={dataUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: "none",
                  border: "1px solid #e5e7eb",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontWeight: 600,
                  background: "white",
                }}
              >
                Open JSON in New Tab
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
