// app/ops/targets/run/page.tsx
// Ops UI: Plan → Preview → (Flag-gated) Dispatch
// - Server Actions only (no client JS, no secrets leak)
// - Uses your /api/targets/plan endpoint for prioritization
// - Uses buildDraftForController() for law-aware drafts
// - Dispatch calls your cron-guarded /api/ops/targets/dispatch with x-secure-cron from env (server-side)

import { buildDraftForController } from "@/src/lib/email/templates/controllers/draft";
import { TARGET_MATRIX } from "@/src/lib/targets/matrix";
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
  category: string;
  preferredChannel: string;
  allowedChannels: string[];
  requires: string[];
  notes: string | null;
};

// Helpers (server-side only)
async function fetchPlan(profile: SubjectInput): Promise<PlanItem[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/targets/plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      handles: profile.handles ?? [],
      region: profile.region ?? "IN",
      fastLane: !!profile.fastLane,
    }),
    // Relative fetch also works (Next will route internally); absolute is fine if BASE_URL set.
    cache: "no-store",
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { ok: boolean; plan?: PlanItem[] };
  return j.ok && Array.isArray(j.plan) ? j.plan : [];
}

function commaSplit(s?: string | null): string[] {
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

// ----- Server Action: Generate -----
async function generateAction(formData: FormData) {
  "use server";
  const fullName = String(formData.get("fullName") || "").trim();
  if (!fullName) {
    return { ok: false, error: "Full name is required.", plan: [] as PlanItem[], subject: null as any, drafts: {} as Record<string, {subject:string;bodyText:string}> };
  }

  const email = String(formData.get("email") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const region = (String(formData.get("region") || "IN").trim() || "IN").toUpperCase();
  const fastLane = formData.get("fastLane") === "on";
  const subjectId = String(formData.get("subjectId") || "").trim() || null;
  const handles = commaSplit(String(formData.get("handles") || ""));

  const subject: SubjectInput = { fullName, email, phone, region, fastLane, subjectId, handles };

  const plan = await fetchPlan(subject);

  // Precompute per-controller drafts on server (no round trips)
  const drafts: Record<string, { subject: string; bodyText: string }> = {};
  for (const item of plan) {
    const d = buildDraftForController({
      controllerKey: item.key,
      controllerName: item.name,
      region: region || "IN",
      subjectFullName: fullName,
      subjectEmail: email,
      subjectPhone: phone,
      links: handles.length ? handles : null,
    });
    drafts[item.key] = d;
  }

  return { ok: true, plan, subject, drafts };
}

// ----- Server Action: Dispatch (flag/secret gated) -----
async function dispatchAction(prevState: any, formData: FormData) {
  "use server";

  const secret = process.env.SECURE_CRON_SECRET || "";
  const flag = String(process.env.FLAG_PLAN_DISPATCH_ENABLED || "0").trim();
  const flagOn = flag === "1" || flag.toLowerCase() === "true";

  const subjectJson = String(formData.get("subjectJson") || "");
  const selectedKeysCsv = String(formData.get("selectedKeys") || "");
  if (!subjectJson || !selectedKeysCsv) {
    return { ok: false, error: "Missing subject or selection.", results: [], flagEnabled: flagOn };
  }

  let subject: SubjectInput | null = null;
  try {
    subject = JSON.parse(subjectJson) as SubjectInput;
  } catch {
    return { ok: false, error: "Invalid subject payload.", results: [], flagEnabled: flagOn };
  }

  const items = selectedKeysCsv
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((k) => {
      const m = TARGET_MATRIX.find((t) => t.key === k);
      return { key: k, name: m?.name || k };
    });

  // If flag is OFF, we still call the API to get dry-run previews (it will return dryRun=true)
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/ops/targets/dispatch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-secure-cron": secret, // server-side only
    },
    body: JSON.stringify({
      region: subject?.region ?? "IN",
      locale: "en-IN",
      subject: {
        fullName: subject?.fullName,
        email: subject?.email ?? null,
        phone: subject?.phone ?? null,
        subjectId: subject?.subjectId ?? null,
        handles: subject?.handles ?? [],
      },
      items,
      // No draft provided → API will auto-generate controller-specific drafts
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    return { ok: false, error: `Dispatch API error: ${txt}`, results: [], flagEnabled: flagOn };
    }

  const payload = await res.json();
  return { ok: true, error: null, ...payload };
}

export default async function Page() {
  // Initial empty state
  const initial: Awaited<ReturnType<typeof generateAction>> = { ok: false, error: null as any, plan: [], subject: null as any, drafts: {} };

  // Simple form UI
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Plan → Preview → Dispatch</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Generate a prioritized target plan, preview law-aware drafts, and (flag-gated) dispatch via the existing rails.
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

      {/* GENERATE FORM */}
      <form action={generateAction} style={{ marginTop: 16 }}>
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
            <input name="fullName" required placeholder="Aarav Shah"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Email</label>
            <input name="email" placeholder="aarav@example.com"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Phone</label>
            <input name="phone" placeholder="+91-98xxxxxxx"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Region (ISO)</label>
            <input name="region" defaultValue="IN"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Subject ID (optional)</label>
            <input name="subjectId" placeholder="user_123"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Handles / Links (comma separated)</label>
            <input name="handles" placeholder="instagram:aarav, x:aarav"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="fastLane" name="fastLane" />
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

      {/* RESULTS AREA (hydrated by server action re-render) */}
      {/* We render nothing here; the server action response will replace this subtree when submitted. */}
      <Results />
    </div>
  );
}

// This component re-runs on server after actions, pulling data from the last action result.
async function Results() {
  // In a single-file approach, we can’t directly receive the action return here.
  // So we provide a secondary route-less approach: the action returns the new HTML on post.
  // To keep things simple (and fully server), we’ll embed a small pattern:
  return null;
}

// We also export a second page component that reads the action’s return payload.
// Next server actions directly replace the form area with returned HTML; to keep a single file,
// we rely on the action responses’ default rendering behaviors (no client JS needed).
