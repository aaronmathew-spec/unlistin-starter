// app/ops/authz/list/export/route.ts
import { NextResponse } from "next/server";
import { listAuthorizations } from "@/src/lib/authz/store";

export const runtime = "nodejs";

function toCSVRow(fields: Array<string | number | null | undefined>): string {
  return fields
    .map((v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (/[,"\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim() || null;
  const limit = Math.max(1, Math.min(1000, Number(searchParams.get("limit") || "500") || 500));
  const offset = Math.max(0, Number(searchParams.get("offset") || "0") || 0);

  // Use the object signature → we need rows + total for UX if desired
  const { rows } = await listAuthorizations({ search: q, limit, offset });

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
  ];

  const lines = [toCSVRow(header)];
  for (const r of rows) {
    lines.push(
      toCSVRow([
        (r as any).id,
        (r as any).subject_full_name,
        (r as any).subject_email,
        (r as any).subject_phone,
        (r as any).region,
        (r as any).signer_name,
        (r as any).signed_at,
        (r as any).manifest_hash,
        (r as any).created_at,
      ]),
    );
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="authorizations_export.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
