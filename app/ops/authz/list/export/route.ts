// app/ops/authz/list/export/route.ts
// Exports Authorization records as CSV.
// Matches current store API:
//   listAuthorizations({ search: string|null, limit: number, offset: number })
//   -> { rows: AuthorizationRecord[]; total: number }

import { NextResponse } from "next/server";
import { listAuthorizations } from "@/src/lib/authz/store";
import type { AuthorizationRecord } from "@/src/lib/authz/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SP = Record<string, string | string[] | undefined>;

function get(sp: SP, k: string) {
  return String(sp[k] || "").trim();
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  const needsQuotes = s.includes(",") || s.includes("\n") || s.includes('"');
  const inner = s.replace(/"/g, '""');
  return needsQuotes ? `"${inner}"` : inner;
}

function toCsv(rows: AuthorizationRecord[]): string {
  const header = [
    "id",
    "subject_full_name",
    "subject_email",
    "subject_phone",
    "region",
    "signer_name",
    "signed_at",
    "manifest_hash",
    "created_at",
    "updated_at",
  ];

  const lines = rows.map((r) =>
    [
      r.id,
      r.subject_full_name,
      r.subject_email ?? "",
      r.subject_phone ?? "",
      r.region ?? "",
      r.signer_name ?? "",
      r.signed_at ? String(r.signed_at as unknown as string) : "",
      r.manifest_hash ?? "",
      (r as any).created_at ? String((r as any).created_at) : "",
      (r as any).updated_at ? String((r as any).updated_at) : "",
    ]
      .map(csvEscape)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = get(searchParams as unknown as SP, "q") || null;

  const limit = Math.max(
    1,
    Math.min(10000, Number(get(searchParams as any, "limit") || "1000") || 1000),
  );
  const page = Math.max(1, Number(get(searchParams as any, "page") || "1") || 1);
  const offset = (page - 1) * limit;

  // Use the current store API (object arg)
  const { rows } = await listAuthorizations({ search: q, limit, offset });

  const csv = toCsv(rows);
  const filename = `authz_export_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
