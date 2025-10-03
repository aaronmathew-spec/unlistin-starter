/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { isAdmin, getSessionUser } from "@/lib/auth";
import { beat } from "@/lib/ops/heartbeat";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

// Centralized RBAC assertion for this file
async function assertAdmin() {
  const ok = await isAdmin();
  if (!ok) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

/**
 * GET /api/admin/overview
 * - Simple roll-up payload (safe to expand later)
 */
export async function GET() {
  try {
    await beat("admin.overview:get");
    await assertAdmin();

    const user = await getSessionUser();

    // Keep this minimal & schema-free to avoid breaking deploys.
    // You can later add DB-backed metrics safely here.
    const payload = {
      ok: true,
      who: user?.email ?? user?.id ?? null,
      // placeholders (expand later with DB-backed counts if you want)
      metrics: {
        prepared_24h: null,
        auto_submit_ready: null,
        followups_due_today: null,
      },
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    const status = Number.isFinite(err?.status) ? err.status : 500;
    return json({ ok: false, error: err?.message || "Internal error" }, { status });
  }
}

/**
 * POST /api/admin/overview
 * - Not used right now (kept to a clear 405 so the API surface is explicit)
 */
export async function POST() {
  try {
    await beat("admin.overview:post");
    await assertAdmin();
    return json({ ok: false, error: "Not implemented" }, { status: 405 });
  } catch (err: any) {
    const status = Number.isFinite(err?.status) ? err.status : 500;
    return json({ ok: false, error: err?.message || "Internal error" }, { status });
  }
}
