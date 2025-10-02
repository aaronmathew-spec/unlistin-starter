/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

type NormalizedHitLite = {
  broker: string;
  url: string;
  kind?: string;
  confidence: number;
  why?: string[];
  preview: { email?: string; name?: string; city?: string };
  adapter?: string;
  state?: string;
};

type HookBody = {
  hits: NormalizedHitLite[];   // redacted, allowlisted-ready
  userState?: string | null;   // optional; e.g., "MH"
  intent?: "remove_or_correct" | "remove" | "correct";
};

/**
 * POST /api/auto/hook/deep-complete
 *
 * Purpose:
 *  - Called by the Deep Scan server route when a run completes.
 *  - Checks per-user Auto-Run prefs; if not enabled → no-op.
 *  - If enabled → forwards the redacted hits to /api/auto/run to create prepared actions.
 *
 * Notes:
 *  - Never persists PII. Hits must be redacted previews + allowlisted evidence URLs only.
 *  - Friendly 200 OK even when no actions are prepared (keeps scans fast & non-blocking).
 */
export async function POST(req: Request) {
  // Load prefs (RLS applies; if you wire auth, key by user_id)
  const db = supa();
  const { data: prefsRow } = await db.from("auto_prefs").select("*").limit(1).maybeSingle();
  const enabled = !!prefsRow?.enabled;
  if (!enabled) {
    return NextResponse.json({ ok: true, prepared: 0, reason: "auto-run-disabled" });
  }

  let body: HookBody | null = null;
  try {
    body = (await req.json()) as HookBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.hits || !Array.isArray(body.hits) || body.hits.length === 0) {
    return NextResponse.json({ ok: true, prepared: 0, reason: "no-hits" });
  }

  // Forward internally to /api/auto/run (JSON-mode AI + ledger handled there)
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!base) {
    // Environment not configured; no-op but success to avoid blocking
    return NextResponse.json({ ok: true, prepared: 0, reason: "site-url-missing" });
  }

  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/api/auto/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hits: body.hits,
        userState: body.userState || null,
        intent: body.intent || "remove_or_correct",
      }),
      // We DO await here, but this endpoint itself should be called fire-and-forget
      // by the Deep Scan route so user latency is not impacted.
    });
    const j = await r.json();
    return NextResponse.json({ ok: true, prepared: j?.prepared ?? 0, actions: j?.actions ?? [] });
  } catch {
    // Non-blocking failure
    return NextResponse.json({ ok: true, prepared: 0, reason: "forward-failed" });
  }
}
