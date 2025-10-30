/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase/admin";

const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();
const FLAG_WEBFORM_EXPORT = process.env.FLAG_WEBFORM_EXPORT === "1";
const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

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
  const status = (url.searchParams.get("status") || "").trim();
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? "200"), 2000));
  const format = (url.searchParams.get("format") || "json").toLowerCase();

  const header = (req.headers.get("x-secure-cron") || "").trim();
  const hasHeader = !!OPS_SECRET && header === OPS_SECRET;

  if (format !== "csv") {
    if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
    if (!hasHeader) return forbidden("Invalid secret");
  } else {
    if (!FLAG_WEBFORM_EXPORT && !hasHeader) return forbidden("export_not_enabled");
  }

  const s = supabaseAdmin();
  let q = s.from(TABLE).select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data || []) as any[];

  if (format === "csv") {
    const headerLine = [
      "id",
      "status",
      "created_at",
      "claimed_at",
      "finished_at",
      "attempts",
      "error",
      "worker_id",
      "subject_id",
      "controller_key",
      "controller_name",
      "subject_name",
      "subject_email",
      "subject_phone",
      "url",
      "meta_json",
      "result_json",
    ].join(",");

    const lines = [headerLine];
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.id),
          csvEscape(r.status),
          csvEscape(r.created_at),
          csvEscape(r.claimed_at),
          csvEscape(r.finished_at),
          csvEscape(r.attempts),
          csvEscape(r.error),
          csvEscape(r.worker_id),
          csvEscape(r.subject_id),
          csvEscape(r.controller_key),
          csvEscape(r.controller_name),
          csvEscape(r.subject_name),
          csvEscape(r.subject_email),
          csvEscape(r.subject_phone),
          csvEscape(r.url),
          csvEscape(r.meta ? JSON.stringify(r.meta) : ""),
          csvEscape(r.result ? JSON.stringify(r.result) : ""),
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
        "content-disposition": `attachment; filename="unlistin-webform-${ts}.csv"`,
      },
    });
  }

  return NextResponse.json({ ok: true, rows });
}
