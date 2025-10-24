// app/api/ops/dlq/export/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { listDLQ } from "@/lib/ops/dlq";
import { assertOpsSecret } from "@/lib/ops/secure";

function csvEscape(s: unknown) {
  if (s === null || s === undefined) return "";
  const v = String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(req: Request) {
  // Optional guard: allow open export if you want—leaving header check on by default
  const forbidden = assertOpsSecret(req);
  if (forbidden) return forbidden;

  const rows = await listDLQ(2000);
  const header = [
    "id",
    "created_at",
    "channel",
    "controller_key",
    "subject_id",
    "error_code",
    "error_note",
    "retries",
    "payload_json",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const payload = r.payload ? JSON.stringify(r.payload) : "";
    lines.push([
      csvEscape(r.id),
      csvEscape(r.created_at),
      csvEscape(r.channel),
      csvEscape(r.controller_key),
      csvEscape(r.subject_id),
      csvEscape(r.error_code),
      csvEscape(r.error_note),
      csvEscape(r.retries ?? 0),
      csvEscape(payload),
    ].join(","));
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
