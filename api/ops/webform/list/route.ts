/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 5000);

  const status = url.searchParams.get("status") || undefined; // queued|running|succeeded|failed
  const controller = url.searchParams.get("controller") || undefined; // fuzzy
  const subject = url.searchParams.get("subject") || undefined; // fuzzy

  // Security model:
  // - JSON: require valid x-secure-cron header (ops-only)
  // - CSV: allowed if either FLAG_WEBFORM_EXPORT=1 or valid header is present
  const header = (req.headers.get("x-secure-cron") || "").trim();
  const hasHeader = !!OPS_SECRET && header === OPS_SECRET;

  if (format !== "csv") {
    if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
    if (!hasHeader) return forbidden("Invalid secret");
  } else {
    if (!FLAG_WEBFORM_EXPORT && !hasHeader) return forbidden("export_not_enabled");
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Base select — keep it aligned with your Queue columns
  let q = sb
    .from(TABLE)
    .select(
      "id, created_at, status, subject_id, subject_email, subject_name, subject_handle, url, meta, attempts, error, result, controller_key, controller_name, claimed_at, finished_at, worker_id, artifact_html, artifact_screenshot"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") q = q.eq("status", status);

  if (controller) {
    // fuzzy across key & name (ilike)
    q = q.or(
      `controller_key.ilike.%${controller}%,controller_name.ilike.%${controller}%`
    );
  }

  if (subject) {
    // fuzzy across common subject fields
    q = q.or(
      `subject_id.ilike.%${subject}%,subject_email.ilike.%${subject}%,subject_name.ilike.%${subject}%,subject_handle.ilike.%${subject}%`
    );
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data || []) as Array<any>;

  if (format === "csv") {
    const head = [
      "id",
      "created_at",
      "status",
      "controller_key",
      "controller_name",
      "subject_id",
      "subject_email",
      "subject_name",
      "subject_handle",
      "attempts",
      "error",
      "url",
      "artifact_html_len",
      "artifact_screenshot_len",
      "result_json",
    ].join(",");

    const lines = [head];
    for (const r of rows) {
      const htmlLen =
        r.artifact_html ? (Buffer.isBuffer(r.artifact_html) ? r.artifact_html.length : String(r.artifact_html).length) : 0;
      const shotLen =
        r.artifact_screenshot
          ? (Buffer.isBuffer(r.artifact_screenshot) ? r.artifact_screenshot.length : String(r.artifact_screenshot).length)
          : 0;

      const resultJson = r.result ? JSON.stringify(r.result) : "";

      lines.push(
        [
          csvEscape(r.id),
          csvEscape(r.created_at),
          csvEscape(r.status),
          csvEscape(r.controller_key),
          csvEscape(r.controller_name),
          csvEscape(r.subject_id),
          csvEscape(r.subject_email),
          csvEscape(r.subject_name),
          csvEscape(r.subject_handle),
          csvEscape(r.attempts ?? 0),
          csvEscape(r.error),
          csvEscape(r.url),
          csvEscape(htmlLen),
          csvEscape(shotLen),
          csvEscape(resultJson),
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

  // JSON (ops/internal)
  return NextResponse.json({ ok: true, rows });
}
