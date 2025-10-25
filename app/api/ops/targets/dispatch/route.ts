// app/api/ops/targets/dispatch/route.ts
// Cron-guarded, flag-gated API to turn a plan into real dispatch jobs.
// Uses existing dispatcher (idempotency + circuit breaker + DLQ). No schema changes.

import { NextResponse } from "next/server";
import { dispatchPlanItem, type PlanItem, type SubjectProfile } from "@/src/lib/targets/dispatch";

export const runtime = "nodejs";

function requireCronHeader(req: Request) {
  const secret = process.env.SECURE_CRON_SECRET || "";
  const got = req.headers.get("x-secure-cron") || "";
  if (!secret || got !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

function flagEnabled(): boolean {
  const v = String(process.env.FLAG_PLAN_DISPATCH_ENABLED || "0").trim();
  return v === "1" || v.toLowerCase() === "true";
}

/**
 * Body shape:
 * {
 *   "subject": {
 *     "fullName":"Aarav Shah",
 *     "email":"aarav@example.com",
 *     "phone":"+91-98xxxxxxx",
 *     "handles":["instagram:aarav","x:aarav"],
 *     "subjectId":"user_123"
 *   },
 *   "items": [
 *     {"key":"truecaller","name":"Truecaller"},
 *     {"key":"naukri","name":"Naukri"},
 *     {"key":"olx","name":"OLX"}
 *   ],
 *   "locale":"en-IN",
 *   "draft": { "subject":"Data removal request", "bodyText":"Please remove…"}
 * }
 */
export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));
    const subject = (body.subject || {}) as SubjectProfile;
    const items = Array.isArray(body.items) ? (body.items as PlanItem[]) : [];
    const locale: string | null = body.locale ?? "en-IN";
    const draft = body.draft ?? null;
    const formUrl = body.formUrl ?? null;
    const action = body.action ?? null;

    if (!subject?.fullName || !items.length) {
      return NextResponse.json(
        { ok: false, error: "missing required: subject.fullName and items[]" },
        { status: 400 },
      );
    }

    const enabled = flagEnabled();
    const results: any[] = [];

    for (const item of items) {
      if (!item?.key) {
        results.push({ controllerKey: null, ok: false, error: "invalid_item" });
        continue;
      }
      if (!enabled) {
        // Dry acknowledgement when flag is off; no dispatch
        results.push({
          controllerKey: item.key,
          ok: true,
          dryRun: true,
          note: "FLAG_PLAN_DISPATCH_ENABLED is not enabled; no job enqueued.",
        });
        continue;
      }

      const res = await dispatchPlanItem({
        item,
        subject,
        locale,
        draft,
        formUrl,
        action,
      });
      results.push(res);
    }

    return NextResponse.json({
      ok: true,
      flagEnabled: enabled,
      count: results.length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
