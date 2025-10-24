/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";
const FLAG_DLQ_EXPORT = process.env.FLAG_DLQ_EXPORT === "1"; // allow CSV without header when enabled

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

function csvEscape(s: unknown) {
  if (s === null || s === undefined) return "";
  const v = String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 2000);
  const controller = url.searchParams.get("controller") || undefined;
  const channel = url.searchParams.get("channel") || undefined;
  const format = (url.searchParams.get("format") || "json").toLowerCase();

  // Security:
  // - JSON mode: require ops header
  // - CSV mode: allow if FLAG_DLQ_EXPORT=1 OR ops header present
  const header = (req.headers.get("x-secure-cron") || "").trim();
  const hasHeader = !!OPS_SECRET && header === OPS_SECRET;

  if (format !== "csv") {
    if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
    if (!hasHeader) return forbidden("Invalid secret");
  } else {
    if (!FLAG_DLQ_EXPORT && !hasHeader) return forbidden("export_not_enabled");
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  let q = sb
    .from("ops_dlq")
    .select("id, created_at, channel, controller_key, subject_id, payload, error_code, error_note, retries")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (controller) q = q.eq("controller_key", controller);
  if (channel) q = q.eq("channel", channel);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data || []) as Array<{
    id: string;
    created_at: string;
    channel: string;
    controller_key: string | null;
    subject_id: string | null;
    payload: Record<string, any> | null;
    error_code: string | null;
    error_note: string | null;
    retries: number | null;
  }>;

  if (format === "csv") {
    const headerLine = [
      "id",
      "created_at",
      "channel",
      "controller_key",
      "subject_id",
      "error_code",
      "error_note",
      "retries",
      "payload_json",
    ].join(",");
    const lines = [headerLine];
    for (const r of rows) {
      const payload = r.payload ? JSON.stringify(r.payload) : "";
      lines.push(
        [
          csvEscape(r.id),
          csvEscape(r.created_at),
          csvEscape(r.channel),
          csvEscape(r.controller_key),
          csvEscape(r.subject_id),
          csvEscape(r.error_code),
          csvEscape(r.error_note),
          csvEscape(r.retries ?? 0),
          csvEscape(payload),
        ].join(",")
      );
    }
    const csv = lines.join("\n");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="unlistin-dlq-${ts}.csv"`,
      },
    });
  }

  // JSON (default)
  return NextResponse.json({ ok: true, rows });
}
