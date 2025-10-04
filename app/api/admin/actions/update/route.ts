/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { beat } from "@/lib/ops/heartbeat";
import { assertAdmin } from "@/lib/auth";

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

const ALLOWED_STATUS = new Set([
  "prepared",
  "sent",
  "follow_up_due",
  "resolved",
  "cancelled",
]);

/**
 * POST /api/admin/actions/update
 * Body: { id: string|number, update: { status?: string } }
 *
 * Returns: { ok: true, updated_id: id } or error
 */
export async function POST(req: Request) {
  await beat("admin.actions.update:post");

  try {
    await assertAdmin();

    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    const status = (body?.update?.status ?? "").toString();

    if (!id) {
      return json({ ok: false, error: "missing-id" }, { status: 400 });
    }
    if (!status || !ALLOWED_STATUS.has(status)) {
      return json({ ok: false, error: "invalid-status" }, { status: 400 });
    }

    const db = supa();
    const { error } = await db
      .from("actions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, updated_id: id });
  } catch (err: any) {
    const status = (err as any)?.status || 500;
    return json({ ok: false, error: err?.message || "unexpected-error" }, { status });
  }
}
