// app/api/ops/targets/dispatch/route.ts
// Cron-guarded, flag-gated API to turn a plan into real dispatch jobs.
// UPDATED: if no draft is provided, we generate per-controller drafts automatically.

import { NextResponse } from "next/server";
import { dispatchPlanItem, type PlanItem, type SubjectProfile } from "@/src/lib/targets/dispatch";
import { buildDraftForController } from "@/src/lib/email/templates/controllers/draft";

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

export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));
    const subject = (body.subject || {}) as SubjectProfile;
    const items = Array.isArray(body.items) ? (body.items as PlanItem[]) : [];
    const locale: string | null = body.locale ?? "en-IN";
    const region: string | null = body.region ?? "IN";
    const providedDraft = body.draft ?? null;
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

      let draft = providedDraft;
      if (!draft) {
        // auto-generate controller-specific draft
        const d = buildDraftForController({
          controllerKey: item.key,
          controllerName: item.name || null,
          region,
          subjectFullName: subject.fullName,
          subjectEmail: subject.email || null,
          subjectPhone: subject.phone || null,
          links: subject.handles || null,
        });
        draft = { subject: d.subject, bodyText: d.bodyText };
      }

      if (!enabled) {
        results.push({
          controllerKey: item.key,
          ok: true,
          dryRun: true,
          note: "FLAG_PLAN_DISPATCH_ENABLED is not enabled; no job enqueued.",
          previewDraft: draft,
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
