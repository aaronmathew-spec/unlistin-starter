/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { beat } from "@/lib/ops/heartbeat";
import { loadControlsMap } from "@/lib/auto/controls";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Minimal JSON helper
function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

// Supabase server client (cookie-bound)
function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

// Basic adapterId sanitizer
function normalizeAdapterId(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  // allow a-z, 0-9, dash, underscore, dot
  return /^[a-z0-9._-]+$/.test(s) ? s : null;
}

// GET: return current adapter controls map
export async function GET() {
  try {
    // Use an allowed beat topic (type-safe)
    await beat("detect.changes");

    // Server-side admin gate
    if (!(await isAdmin())) {
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // { [adapterId]: { killed?: boolean, daily_cap?: number, min_confidence?: number, ... } }
    const controls = await loadControlsMap();
    return NextResponse.json({ ok: true, controls });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "unexpected-error" }, { status: 500 });
  }
}

// POST: upsert a single adapter's controls
// Body: { adapterId: string, updates: { killed?: boolean, daily_cap?: number, min_confidence?: number } }
export async function POST(req: Request) {
  try {
    await beat("detect.changes");

    if (!(await isAdmin())) {
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const adapterId = normalizeAdapterId(body?.adapterId);
    const updates = body?.updates ?? {};

    if (!adapterId) {
      return json({ ok: false, error: "missing-or-invalid-adapterId" }, { status: 400 });
    }

    // Only allow specific, known fields; coerce/validate types gently.
    const patch: Record<string, any> = {};
    if (typeof updates.killed === "boolean") patch.killed = updates.killed;
    if (Number.isFinite(updates.daily_cap)) patch.daily_cap = Number(updates.daily_cap);
    if (Number.isFinite(updates.min_confidence))
      patch.min_confidence = Math.max(0, Math.min(1, Number(updates.min_confidence)));

    if (Object.keys(patch).length === 0) {
      return json({ ok: false, error: "no-valid-fields" }, { status: 400 });
    }

    // Persist via Supabase — assumes table "adapter_controls" with primary key "adapter"
    const db = supa();
    const { error } = await db
      .from("adapter_controls")
      .upsert({ adapter: adapterId, ...patch }, { onConflict: "adapter" });

    if (error) {
      return json({ ok: false, error: error.message }, { status: 400 });
    }

    // Return fresh view so UI can reflect the latest
    const controls = await loadControlsMap();
    return NextResponse.json({ ok: true, adapter: adapterId, controls });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "unexpected-error" }, { status: 500 });
  }
}
