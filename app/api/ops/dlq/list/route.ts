/* app/api/ops/dlq/list/route.ts
 * JSON/CSV export endpoint for DLQ.
 *   GET ?limit=200&channel=webform&controller=truecaller
 *   GET ?format=csv ...  (allowed if FLAG_DLQ_EXPORT=1 or ops header present)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listDLQ } from "@/lib/ops/dlq";

const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();
const FLAG_DLQ_EXPORT = process.env.FLAG_DLQ_EXPORT === "1";

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
  const limit = Math.max(1, Math.min(2000, Number(url.searchParams.get("limit") ?? "200")));
  const controller = url.searchParams.get("controller") || "";
  const channel = url.searchParams.get("channel") || "";
  const format = (url.searchParams.get("format") || "json").toLowerCase();

  const header = (req.headers.get("x-secure-cron") || "").trim();
  const hasHeader = !!OPS_SECRET && header === OPS_SECRET;

  // Security:
  // - JSON mode: require ops header
  // - CSV mode: allow when FLAG_DLQ_EXPORT=1 OR ops header present
  if (format !== "csv") {
    if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
    if (!hasHeader) return forbidden("invalid_secret");
  } else {
    if (!FLAG_DLQ_EXPORT && !hasHeader) return forbidden("export_not_enabled");
  }

  try {
    let rows = await listDLQ(limit);
    if (controller) rows = rows.filter((r) => String(r.controller_key || "").includes(controller));
    if (channel) rows = rows.filter((r) => String(r.channel || "").includes(channel));

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
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "list_failed" },
      { status: 500 }
    );
  }
}
