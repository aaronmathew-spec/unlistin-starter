/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { beat } from "@/lib/ops/heartbeat";
import { assertAdmin, getSessionUser } from "@/lib/auth";

// Small JSON helper
function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

export async function GET() {
  try {
    // Use a type-safe topic for beat()
    await beat("detect.changes");

    // Server-side RBAC
    await assertAdmin();

    // Optional: include who is viewing (admin) for context in UI
    const user = await getSessionUser();

    // Keep the payload light and aggregate-only; you can wire real metrics later.
    const overview = {
      automation_enabled_users: null, // fill from a metrics table later
      prepared_actions_24h: null,
      auto_submit_ready: null,
      followups_due_today: null,
      // add more rollups as you create admin metrics
    };

    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      viewer: { id: user?.id ?? null, email: user?.email ?? null },
      overview,
    });
  } catch (err: any) {
    // If assertAdmin throws or anything else goes wrong, return 403/500 accordingly.
    const msg = err?.message || "unexpected-error";
    const status = /forbidden|not\s*admin/i.test(msg) ? 403 : 500;
    return json({ ok: false, error: msg }, { status });
  }
}
