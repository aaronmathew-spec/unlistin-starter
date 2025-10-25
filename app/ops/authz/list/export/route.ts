// app/ops/authz/list/export/route.ts
import { NextResponse } from "next/server";
import { listAuthorizations } from "@/src/lib/authz/store";

function csvEscape(s: string) {
  const needsQuote = /[",\n]/.test(s);
  const v = s.replace(/"/g, '""');
  return needsQuote ? `"${v}"` : v;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(1000, Number(searchParams.get("limit") || "200") || 200));
  const offset = Math.max(0, Number(searchParams.get("offset") || "0") || 0);

  // NOTE: matches store API (limit, offset) -> AuthorizationRecord[]
  const rows = await listAuthorizations(limit, offset);

  const filtered = q
    ? rows.filter((r) => {
        const hay = [
          r.subject_full_name || "",
          r.subject_email || "",
          r.subject_phone || "",
          r.signer_name || "",
          r.region || "",
          r.manifest_hash || "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : rows;

  const header = [
    "id",
    "subject_id",
    "subject_full_name",
    "subject_email",
    "subject_phone",
    "signer_name",
    "region",
    "manifest_hash",
    "created_at",
  ];

  const lines = [
    header.join(","),
    ...filtered.map((r) =>
      [
        r.id,
        (r as any).subject_id ?? "",
        r.subject_full_name ?? "",
        r.subject_email ?? "",
        r.subject_phone ?? "",
        r.signer_name ?? "",
        r.region ?? "",
        r.manifest_hash ?? "",
        (r as any).created_at ?? "",
      ]
        .map((x) => csvEscape(String(x ?? "")))
        .join(","),
    ),
  ];

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
