/* app/api/ops/webform/list/route.ts
 * JSON/CSV export for webform jobs.
 *   GET ?limit=200&status=queued|running|succeeded|failed|all&controller=...&subject=...
 *   GET ?format=csv ...  (allowed if FLAG_WEBFORM_EXPORT=1 or ops header present)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";
const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();
const FLAG_WEBFORM_EXPORT = process.env.FLAG_WEBFORM_EXPORT === "1";
const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase env missing");
  }
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
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit") ?? "200")));
  const status = (url.searchParams.get("status") || "all").toLowerCase();
  const controller = (url.searchParams.get("controller") || "").trim();
  const subject = (url.searchParams.get("subject") || "").trim();
  const format = (url.searchParams.get("format") || "json").toLowerCase();

  const hdr = (req.headers.get("x-secure-cron") || "").trim();
  const hasOps = !!OPS_SECRET && hdr === OPS_SECRET;

  // Security: JSON requires ops header; CSV allowed with flag or ops header
  if (format !== "csv") {
    if (!OPS_SECRET) return forbidden("secret_not_configured");
    if (!hasOps) return forbidden("invalid_secret");
  } else {
    if (!FLAG_WEBFORM_EXPORT && !hasOps) return forbidden("export_not_enabled");
  }

  try {
    const client = sb();
    let query = client
      .from(TABLE)
      .select(
        "id, status, subject_id, url, meta, attempts, error, result, created_at, claimed_at, finished_at, worker_id, controller_key, controller_name, subject_name, subject_email, subject_handle"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") query = query.eq("status", status);
    if (controller) {
      query = query.or(
        `controller_key.ilike.%${controller}%,controller_name.ilike.%${controller}%`
      );
    }
    if (subject) {
      query = query.or(
        `subject_id.ilike.%${subject}%,subject_email.ilike.%${subject}%,subject_name.ilike.%${subject}%,subject_handle.ilike.%${subject}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    const rows = data || [];

    if (format === "csv") {
      const headerLine = [
        "id",
        "created_at",
        "status",
        "controller",
        "subject",
        "attempts",
        "url",
        "error",
        "result_json",
      ].join(",");

      const lines = [headerLine];
      for (const r of rows) {
        const controllerCell =
          r.controller_name ||
          r.controller_key ||
          r.meta?.controllerName ||
          r.meta?.controllerKey ||
          "";
        const subjectCell =
          r.subject_name ||
          r.subject_email ||
          r.subject_handle ||
          r.subject_id ||
          r.meta?.subject?.email ||
          r.meta?.subject?.name ||
          "";
        const urlCell = r.meta?.formUrl || r.url || "";
        const resJson = r.result ? JSON.stringify(r.result) : "";

        lines.push(
          [
            csvEscape(r.id),
            csvEscape(r.created_at),
            csvEscape(r.status),
            csvEscape(controllerCell),
            csvEscape(subjectCell),
            csvEscape(r.attempts ?? 0),
            csvEscape(urlCell),
            csvEscape(r.error),
            csvEscape(resJson),
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
          "content-disposition": `attachment; filename="webform-jobs-${ts}.csv"`,
        },
      });
    }

    // JSON
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "list_failed" },
      { status: 500 }
    );
  }
}
