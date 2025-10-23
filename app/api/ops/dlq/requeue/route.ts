/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueWebformJob } from "@/lib/webform/queue";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}
function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  const body = (await req.json().catch(() => ({}))) as { id?: string | number };
  if (!body.id) return bad(400, "id_required");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: row, error } = await sb.from("ops_dlq").select("*").eq("id", body.id).single();
  if (error || !row) return bad(404, "not_found");

  // we only requeue webform channel in this sample; extend for email/API as needed
  if (row.channel !== "webform") return bad(400, "unsupported_channel");

  // reconstruct webform enqueue request
  const payload = row.payload || {};
  const res = await enqueueWebformJob({
    controllerKey: row.controller_key,
    controllerName: payload.controllerName || row.controller_key,
    subject: {
      name: payload.subject?.name || undefined,
      email: payload.subject?.email || undefined,
      phone: payload.subject?.phone || undefined,
      handle: payload.subject?.handle || undefined,
      id: payload.subject?.id || undefined,
    },
    locale: payload.locale || "en-IN",
    formUrl: payload.formUrl || undefined,
    draft: payload.draft
      ? {
          subject: payload.draft.subject || "",
          bodyText: payload.draft.bodyText || "",
        }
      : undefined,
  });

  // on success, delete from DLQ
  await sb.from("ops_dlq").delete().eq("id", row.id);

  return NextResponse.json({
    ok: true,
    requeuedAs: (res as any)?.id ?? null,
  });
}
