/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { beat } from "@/lib/ops/heartbeat";
import { assertAdmin } from "@/lib/auth";
import {
  FEATURE_AI_UI,
  FEATURE_AI_SERVER,
  FEATURE_AGENTS_UI,
  FEATURE_AGENTS_SERVER,
} from "@/lib/flags";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * GET /api/admin/flags
 * Exposes runtime feature flags (read-only) for admin.
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
    return json({ ok: false, error: err?.message ?? String(err) }, { status: 400 });
  }
}
