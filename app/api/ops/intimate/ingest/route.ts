// app/api/ops/intimate/ingest/route.ts
// Priority intake for intimate image / deepfake complaints (24h window).
// Secured by x-secure-cron to avoid public invocation. Initially enqueues a stub ticket.

import { NextResponse } from "next/server";
import { SLA } from "@/src/lib/sla/policy";

export const runtime = "nodejs";

function requireCronHeader(req: Request) {
  const secret = process.env.SECURE_CRON_SECRET || "";
  const got = req.headers.get("x-secure-cron") || "";
  if (!secret || got !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));
    const subjectFullName = String(body.subjectFullName || "");
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : undefined;
    const evidence = Array.isArray(body.evidence) ? body.evidence : [];
    const category = String(body.category || "intimate-image"); // "deepfake" also fine
    const region = typeof body.region === "string" ? body.region : "IN";

    if (!subjectFullName || evidence.length === 0) {
      return NextResponse.json(
        { ok: false, error: "missing_required_fields" },
        { status: 400 }
      );
    }

    // TODO: wire to SQS/Redis high-priority queue, attach authorization manifest (if available).
    const ticketId = `IM-${Date.now()}`;

    return NextResponse.json({
      ok: true,
      ticketId,
      priority: "critical",
      category,
      region,
      slaHours: SLA.intimateFastLane.ackHours,
      note:
        "Queued (stub). Wire this to your HQ queue and dispatch templates (platform & search layer).",
      echo: {
        subjectFullName,
        subjectEmail: subjectEmail ?? null,
        evidenceCount: evidence.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "exception" },
      { status: 500 }
    );
  }
}
