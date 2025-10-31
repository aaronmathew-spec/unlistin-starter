/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Security/config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();
const FLAG_WEBFORM_EXPORT = process.env.FLAG_WEBFORM_EXPORT === "1"; // allow CSV without header when enabled
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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 2000);

  // Optional filters
  const status = url.searchParams.get("status") || undefined;           // queued|running|succeeded|failed
  const controller = url.searchParams.get("controller") || undefined;   // ilike on controller_key
  const subject = url.searchParams.get("subject") || undefined;         // ilike on subject fields

  // Security rules:
  // - JSON mode requires x-secure-cron header matching SECURE_CRON_SECRET
  // - CSV mode allowed if FLAG_WEBFORM_EXPORT=1 OR header matches
  const header = (req.headers.get("x-secure-cron") || "").trim();
  const hasHeader = !!OPS_SECRET && header === OPS_SECRET;

  if (format !== "csv") {
    if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
    if (!hasHeader) return forbidden("invalid_secret");
  } else {
    if (!FLAG_WEBFORM_EXPORT && !hasHeader) return forbidden("export_not_enabled");
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  let q = sb
    .from(TABLE)
    .select(
      [
        "id",
        "status",
        "subject_id",
        "url",
        "meta",
        "attempts",
        "error",
        "result",
        "created_at",
        "claimed_at",
        "finished_at",
        "worker_id",
        "controller_key",
        "controller_name",
        "subject_name",
        "subject_email",
        "subject_handle",
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && ["queued", "running", "succeeded", "failed"].includes(status)) {
    q = q.eq("status", status);
  }
  if (controller) {
    q = q.ilike("controller_key", `%${controller}%`);
  }
  if (subject) {
    q = q.or(
      `subject_id.ilike.%${subject}%,subject_email.ilike.%${subject}%,subject_name.ilike.%${subject}%`
    );
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data || []) as Array<Record<string, any>>;

  if (format === "csv") {
    const headerLine = [
      "id",
      "created_at",
      "status",
      "controller_key",
      "controller_name",
      "subject_id",
      "subject_name",
      "subject_email",
      "attempts",
      "error",
      "url",
      "meta_json",
      "result_json",
    ].join(",");

    const lines = [headerLine];

    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.id),
          csvEscape(r.created_at),
          csvEscape(r.status),
          csvEscape(r.controller_key),
          csvEscape(r.controller_name),
          csvEscape(r.subject_id),
          csvEscape(r.subject_name),
          csvEscape(r.subject_email),
          csvEscape(r.attempts ?? 0),
          csvEscape(r.error),
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
        "content-disposition": `attachment; filename="webform-queue-${ts}.csv"`,
      },
    });
  }

  return NextResponse.json({ ok: true, rows });
}
