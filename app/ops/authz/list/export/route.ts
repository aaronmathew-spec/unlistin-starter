// app/ops/authz/list/export/route.ts
// CSV export of authorization records (server-only)

import { NextResponse } from "next/server";
import { listAuthorizations } from "@/src/lib/authz/store";

export const runtime = "nodejs";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = Math.max(1, Math.min(1000, Number(searchParams.get("limit") || "1000") || 1000));

  // matches store API: object arg returning { rows, total }
  const { rows } = await listAuthorizations({ search: q || null, limit, offset: 0 });

  const header = [
    "id",
    "subject_id",
    "subject_full_name",
    "subject_email",
    "subject_phone",
    "region",
    "signer_name",
    "signed_at",
    "manifest_hash",
    "created_at",
  ].join(",");

  const body = rows
    .map((r) =>
      [
        r.id,
        (r as any).subject_id ?? "",
        r.subject_full_name ?? "",
        r.subject_email ?? "",
        r.subject_phone ?? "",
        r.region ?? "",
        r.signer_name ?? "",
        (r as any).signed_at ?? "",
        r.manifest_hash ?? "",
        (r as any).created_at ?? "",
      ]
        .map(csvEscape)
        .join(","),
    )
    .join("\n");

  const csv = `${header}\n${body}\n`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="authorizations.csv"',
      "Cache-Control": "no-store",
    },
  });
}
