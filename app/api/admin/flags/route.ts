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

// JSON helper
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

    if (!(await isAdmin())) {
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const flags = {
      FEATURE_AI_UI,
      FEATURE_AI_SERVER,
      FEATURE_AGENTS_UI,
      FEATURE_AGENTS_SERVER,
    };

    return NextResponse.json({ ok: true, flags });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "unexpected-error" }, { status: 500 });
  }
}
