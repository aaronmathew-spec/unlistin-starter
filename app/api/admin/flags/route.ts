/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { beat } from "@/lib/ops/heartbeat";

// Minimal JSON helper
function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

export async function GET() {
  try {
    await beat("admin.flags:get");

    if (!(await isAdmin())) {
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // Surface current server + client flags so the admin UI can render truth.
    const flags = {
      FEATURE_AI_UI:       (process.env.NEXT_PUBLIC_FEATURE_AI ?? "0") === "1",
      FEATURE_AI_SERVER:   (process.env.FEATURE_AI_SERVER ?? "0") === "1",
      FEATURE_AGENTS_UI:   (process.env.NEXT_PUBLIC_FEATURE_AGENTS ?? "0") === "1",
      FEATURE_AGENTS_SERVER:(process.env.FEATURE_AGENTS_SERVER ?? "0") === "1",
    };

    return NextResponse.json({ ok: true, flags });
  } catch (err: any) {
    return json(
      { ok: false, error: err?.message || "unexpected-error" },
      { status: 500 }
    );
  }
}
