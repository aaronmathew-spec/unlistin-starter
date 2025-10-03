/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { recordOutcome } from "@/lib/auto/learn";
import { beat } from "@/lib/ops/heartbeat";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function headWithTimeout(url: string, ms = 5000): Promise<Response> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { method: "HEAD", redirect: "follow", signal: ac.signal });
  } finally {
    clearTimeout(to);
  }
}

function inferAdapterFrom(broker: string, url?: string) {
  const s = (broker || url || "").toLowerCase();
  if (s.includes("justdial")) return "justdial";
  if (s.includes("sulekha")) return "sulekha";
  if (s.includes("indiamart")) return "indiamart";
  return "generic";
}

/**
 * POST /api/detect/changes
 * Body: { limit?: number }
 *
 * Safe "change detection" for sent actions (allowlisted URLs only).
 * - If the evidence URL now returns 404/410, we auto-close the action as resolved (removed).
 * - Writes non-PII note into actions.meta.change and heartbeat.
 */
export async function POST(req: Request) {
  await beat("detect.changes");

  let limit = 20;
  try {
    const body = await req.json().catch(() => ({}));
    if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.min(50, body.limit));
  } catch {
    // ignore
  }

  const db = supa();

  // Pull 'sent' actions with allowlisted evidence
  const { data: acts, error } = await db
    .from("actions")
    .select("id, broker, status, evidence, meta, state, adapter")
    .eq("status", "sent")
    .limit(limit);

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  if (!acts || acts.length === 0) return NextResponse.json({ ok: true, checked: 0, closed: 0 });

  let closed = 0;
  let checked = 0;

  for (const a of acts) {
    const ev = Array.isArray(a.evidence) ? a.evidence : [];
    const url = ev[0]?.url;
    if (!url || !isAllowed(url)) continue;

    checked++;

    // polite pacing
    await sleep(50);

    let res: Response | null = null;
    try {
      res = await headWithTimeout(url, 5000);
    } catch {
      // HEAD may be blocked; fall back to GET (metadata only)
      try {
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 5000);
        res = await fetch(url, { method: "GET", redirect: "follow", signal: ac.signal });
        clearTimeout(to);
      } catch {
        res = null;
      }
    }

    const status = res?.status ?? 0;

    // Auto-close only on strong signals
    if (status === 404 || status === 410) {
      // Mark resolved
      const { error: uerr } = await db
        .from("actions")
        .update({
          status: "resolved",
          meta: {
            ...(a.meta || {}),
            change: {
              last_checked_at: new Date().toISOString(),
              last_status: status,
              signal: "gone",
            },
          },
        })
        .eq("id", a.id);

      if (!uerr) {
        closed++;

        // Learning hook: removed
        const adapterId = (a as any).adapter || inferAdapterFrom(a.broker, url);
        await recordOutcome({
          action_id: a.id,
          broker: a.broker,
          state: (a as any).state || null,
          adapter: adapterId,
          resolution: "removed",
          took_ms: null,
        });
      }
      continue;
    }

    // Otherwise, just update last check marker
    await db
      .from("actions")
      .update({
        meta: {
          ...(a.meta || {}),
          change: {
            last_checked_at: new Date().toISOString(),
            last_status: status || null,
            signal: "unknown",
          },
        },
      })
      .eq("id", a.id);
  }

  return NextResponse.json({ ok: true, checked, closed });
}
