/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { beat } from "@/lib/ops/heartbeat";
import {
  FEATURE_AI_UI,
  FEATURE_AI_SERVER,
  FEATURE_AGENTS_UI,
  FEATURE_AGENTS_SERVER,
} from "@/lib/flags";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

async function assertAdmin() {
  const ok = await isAdmin();
  if (!ok) throw Object.assign(new Error("Forbidden"), { status: 403 });
}

/**
 * GET /api/admin/flags
 * - Returns the *effective* feature flags (from env).
 * - These are read-only at runtime on Vercel; POST returns 405.
 */
export async function GET() {
  try {
    await beat("admin.flags:get");
    await assertAdmin();

    const flags = {
      FEATURE_AI_UI,
      FEATURE_AI_SERVER,
      FEATURE_AGENTS_UI,
      FEATURE_AGENTS_SERVER,
    };

    return NextResponse.json({ ok: true, flags });
  } catch (err: any) {
    const status = Number.isFinite(err?.status) ? err.status : 500;
    return json({ ok: false, error: err?.message || "Internal error" }, { status });
  }
}

/**
 * POST /api/admin/flags
 * - Intentionally returns 405 (flags are env-backed).
 * - If you later persist flags in Supabase, swap this out for an upsert.
 */
export async function POST() {
  try {
    await beat("admin.flags:post");
    await assertAdmin();
    return json(
      { ok: false, error: "Runtime flag changes are not supported (env-backed)" },
      { status: 405 }
    );
  } catch (err: any) {
    const status = Number.isFinite(err?.status) ? err.status : 500;
    return json({ ok: false, error: err?.message || "Internal error" }, { status });
  }
}
