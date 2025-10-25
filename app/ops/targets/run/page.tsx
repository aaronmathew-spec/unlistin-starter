// app/ops/targets/run/page.tsx
// Ops UI: Plan → Preview → (server-only) Dispatch Helper (no client JS)

import { buildDraftForController } from "@/src/lib/email/templates/controllers/draft";
import { resolvePolicyByRegion } from "@/src/lib/policy/dsr";

export const dynamic = "force-dynamic";

type SubjectInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  handles?: string[] | null;
  region?: string | null;
  fastLane?: boolean | null;
  subjectId?: string | null;
};

type PlanItem = {
  key: string;
  name: string;
  category?: string;
  preferredChannel?: string;
  allowedChannels?: string[];
  requires?: string[];
  notes?: string | null;
};

function parseBool(s?: string | null): boolean {
  if (!s) return false;
  const v = String(s).trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

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

async function fetchPlan(profile: Required<Pick<SubjectInput, "fullName">> & SubjectInput): Promise<PlanItem[]> {
  const payload = {
    fullName: profile.fullName,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    handles: profile.handles ?? [],
    region: profile.region ?? "IN",
    fastLane: !!profile.fastLane,
  };

  const res = await fetch("/api/targets/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { ok: boolean; plan?: PlanItem[] };
  return j.ok && Array.isArray(j.plan) ? j.plan : [];
}

function toCurlDispatch(args: {
  subject: SubjectInput;
  items: PlanItem[];
}): string {
  const body = {
    region: args.subject.region ?? "IN",
    locale: "en-IN",
    subject: {
      fullName: args.subject.fullName,
      email: args.subject.email ?? null,
      phone: args.subject.phone ?? null,
      subjectId: args.subject.subjectId ?? null,
      handles: args.subject.handles ?? [],
    },
    items: args.items.map((i) => ({ key: i.key, name: i.name })),
  };
  return [
    `curl -s -X POST https://<your-host>/api/ops/targets/dispatch \\`,
    `  -H "x-secure-cron: $SECURE_CRON_SECRET" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body)}' | jq`,
  ].join("\n");
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
  const fastLane = parseBool(String(searchParams.fastLane || ""));

  const subject: SubjectInput = { fullName, email, phone, region, subjectId, handles, fastLane };

  let plan: PlanItem[] = [];
  let drafts: Record<string, { subject: string; bodyText: string }> = {};
  let lawLabel: string | null = null;

  if (fullName) {
    plan = await fetchPlan({ fullName, email, phone, region, handles, fastLane, subjectId });
    const law = resolvePolicyByRegion(region);
    lawLabel = law ? `${law.name} (${law.key})` : null;

    drafts = {};
    for (const item of plan) {
      drafts[item.key] = buildDraftForController({
        controllerKey: item.key,
        controllerName: item.name,
        region,
        subjectFullName: fullName,
        subjectEmail: email,
        subjectPhone: phone,
        links: handles.length ? handles : null,
      });
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Plan → Preview → Dispatch</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Generate a prioritized target plan, preview drafts, and (flag/cron guarded) dispatch — all server-side.
          </p>
        </div>
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

      {/* Query form (GET) */}
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
            <label style={{ fontSize: 12, color: "#6b7280" }}>Subject ID (optional)</label>
            <input
              name="subjectId"
              defaultValue={subjectId ?? ""}
              placeholder="user_123"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Handles / Links (comma separated)</label>
            <input
              name="handles"
              defaultValue={handles.join(", ")}
              placeholder="instagram:aarav, x:aarav"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="fastLane" name="fastLane" defaultChecked={!!fastLane} />
            <label htmlFor="fastLane" style={{ fontSize: 12, color: "#6b7280" }}>
              24h Fast Lane (intimate image/deepfake)
            </label>
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
              Generate Plan
            </button>
          </div>
        </div>
      </form>

      {/* Render results if we have a fullName (i.e., a query-triggered render) */}
      {fullName ? (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Detected Law</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{lawLabel || "—"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Subject</div>
                <div style={{ marginTop: 2 }}>
                  {mono(subject.fullName)}{" "}
                  {subject.email ? <>· {mono(subject.email)}</> : null}{" "}
                  {subject.phone ? <>· {mono(subject.phone)}</> : null}
                </div>
              </div>
            </div>
          </div>

          {/* Plan table */}
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
              Generated Plan ({plan.length})
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
                    <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Key</th>
                    <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Preferred</th>
                    <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Allowed</th>
                    <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Requires</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.length ? (
                    plan.map((p) => (
                      <tr key={p.key} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ padding: 12 }}>{p.name}</td>
                        <td style={{ padding: 12 }}>{mono(p.key)}</td>
                        <td style={{ padding: 12 }}>{p.preferredChannel || "—"}</td>
                        <td style={{ padding: 12 }}>{(p.allowedChannels || []).join(", ") || "—"}</td>
                        <td style={{ padding: 12 }}>{(p.requires || []).join(", ") || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                        No items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Draft previews */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 16 }}>
            {plan.map((p) => {
              const d = drafts[p.key];
              return (
                <div
                  key={p.key}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "white",
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{p.name}</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{d?.subject || "—"}</div>
                  <pre
                    style={{
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                      background: "#f9fafb",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  >
{d?.bodyText || ""}
                  </pre>
                </div>
              );
            })}
          </div>

          {/* Dispatch helpers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            {/* a) One-click server dispatch (navigates to results page) */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "white",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Dispatch Selected (server)</div>
              <form method="GET" action="/ops/targets/run/dispatch">
                <input type="hidden" name="fullName" value={subject.fullName} />
                <input type="hidden" name="email" value={subject.email ?? ""} />
                <input type="hidden" name="phone" value={subject.phone ?? ""} />
                <input type="hidden" name="region" value={subject.region ?? "IN"} />
                <input type="hidden" name="subjectId" value={subject.subjectId ?? ""} />
                <input type="hidden" name="handles" value={(subject.handles ?? []).join(",")} />
                <div>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>Controller keys (comma separated)</label>
                  <input
                    name="keys"
                    defaultValue={plan.map((p) => p.key).join(",")}
                    style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
                    placeholder="truecaller,naukri,olx"
                  />
                </div>
                <div style={{ textAlign: "right", marginTop: 8 }}>
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
                    Dispatch → View Results
                  </button>
                </div>
              </form>
              <p style={{ color: "#6b7280", marginTop: 8 }}>
                Uses your server to call the cron-guarded API with <code>x-secure-cron</code>. Honors{" "}
                <code>FLAG_PLAN_DISPATCH_ENABLED</code> (dry-run vs enqueue).
              </p>
            </div>

            {/* b) cURL */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "white",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>Dispatch via cURL</div>
              <p style={{ color: "#6b7280", marginTop: 6 }}>
                Set <code>SECURE_CRON_SECRET</code> and run from your terminal.
              </p>
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
{toCurlDispatch({ subject, items: plan })}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
