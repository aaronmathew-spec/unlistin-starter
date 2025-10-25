// app/api/ops/sla/scan/route.ts
// Returns "overdue by SLA" buckets from recent dispatch logs (dry, no email).
// Secured by x-secure-cron header. No DB writes.

import { NextResponse } from "next/server";
import { listDispatchLog } from "@/lib/dispatch/query";
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

function hoursSince(iso: string): number {
  const t = new Date(iso).getTime();
  const now = Date.now();
  return (now - t) / (1000 * 60 * 60);
}

export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit ?? 2000), 5000));
    const minAgeHours = Number(body.minAgeHours ?? SLA.standard.firstReminderHours); // default: 7d
    const sinceHours = Number(body.lookbackHours ?? 24 * 30); // scan last 30 days by default

    // Pull recent window (bounded)
    let rows: Awaited<ReturnType<typeof listDispatchLog>> = [];
    try {
      rows = await listDispatchLog(limit);
    } catch {
      rows = [];
    }

    // Filter to time window
    const recent = rows.filter(r => hoursSince(r.created_at) <= sinceHours);

    // Overdue = not ok AND older than minAgeHours (since created)
    const overdue = recent.filter(r => !r.ok && hoursSince(r.created_at) >= minAgeHours);

    // Group by controller
    const perController = new Map<string, { total: number; examples: any[] }>();
    for (const r of overdue) {
      const k = r.controller_key || "unknown";
      const slot = perController.get(k) || { total: 0, examples: [] };
      slot.total += 1;
      if (slot.examples.length < 10) {
        slot.examples.push({
          created_at: r.created_at,
          channel: r.channel,
          provider_id: r.provider_id,
          error: r.error ?? r.note ?? null,
        });
      }
      perController.set(k, slot);
    }

    const controllers = Array.from(perController.entries())
      .map(([controllerKey, s]) => ({ controllerKey, total: s.total, examples: s.examples }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      ok: true,
      window: { lookbackHours: sinceHours, minAgeHours },
      counts: { totalScanned: recent.length, overdue: overdue.length },
      controllers,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
