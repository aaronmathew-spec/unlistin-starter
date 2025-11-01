/* app/api/ops/webform/list/route.ts
 * JSON/CSV export endpoint for webform jobs.
 *   GET ?limit=200&status=queued|running|succeeded|failed|all&controller=...&subject=...
 *   GET ?format=csv ...  (allowed if FLAG_WEBFORM_EXPORT=1 or ops header present)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";
const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();
const FLAG_WEBFORM_EXPORT = process.env.FLAG_WEBFORM_EXPORT === "1";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

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

  const qLimit = Math.max(1, Math.min(2000, Number(url.searchParams.get("limit") ?? "200")));
  const qStatusRaw = (url.searchParams.get("status") || "all").toLowerCase();
  const qController = (url.searchParams.get("controller") || "").trim();
  const qSubject = (url.searchParams.get("subject") || "").trim();

  const header = (req.headers.get("x-secure-cron") || "").trim();
  const hasHeader = !!OPS_SECRET && header === OPS_SECRET;

  // Security:
  // - JSON mode: require ops header
  // - CSV mode: allow when FLAG_WEBFORM_EXPORT=1 OR ops header present
  if (format !== "csv") {
    if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
    if (!hasHeader) return forbidden("invalid_secret");
  } else {
    if (!FLAG_WEBFORM_EXPORT && !hasHeader) return forbidden("export_not_enabled");
  }

  const s = sb();

  // Columns aligned with Queue UI
  let query = s
    .from(TABLE)
    .select(
      "id, status, subject_id, url, meta, attempts, error, result, created_at, claimed_at, finished_at, worker_id, controller_key, controller_name, subject_name, subject_email, subject_handle"
    )
    .order("created_at", { ascending: false })
    .limit(qLimit);

  if (qStatusRaw && qStatusRaw !== "all") {
    query = query.eq("status", qStatusRaw);
  }
  if (qController) {
    query = query.or(
      `controller_key.ilike.%${qController}%,controller_name.ilike.%${qController}%`
    );
  }
  if (qSubject) {
    query = query.or(
      `subject_id.ilike.%${qSubject}%,subject_email.ilike.%${qSubject}%,subject_name.ilike.%${qSubject}%,subject_handle.ilike.%${qSubject}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "list_failed" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as any[];

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
      "subject_handle",
      "url",
      "attempts",
      "error",
      "result_json",
      "claimed_at",
      "finished_at",
      "worker_id",
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
          csvEscape(r.subject_handle),
          csvEscape(r.url),
          csvEscape(r.attempts ?? 0),
          csvEscape(r.error),
          csvEscape(r.result ? JSON.stringify(r.result) : ""),
          csvEscape(r.claimed_at),
          csvEscape(r.finished_at),
          csvEscape(r.worker_id),
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
        "x-content-type-options": "nosniff",
        "content-disposition": `attachment; filename="unlistin-webform-jobs-${ts}.csv"`,
      },
    });
  }

  // JSON
  return NextResponse.json({ ok: true, rows });
}
