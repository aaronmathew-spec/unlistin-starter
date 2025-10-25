// app/api/subject/authorization/manifest/route.ts
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildAuthorizationManifest } from "@/src/lib/authz/manifest";
import type { AuthorizationRecord } from "@/src/lib/authz/types";

/** Minimal EvidenceRef compatible with your manifest builder */
type EvidenceRef = {
  kind:
    | "id_government"
    | "id_selfie_match"
    | "authority_letter"
    | "purchase_receipt"
    | "email_control"
    | "phone_otp";
  label: string;
  url: string;
};

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error(
      "supabase_admin_missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function publicUrl(
  supa: ReturnType<typeof getAdmin>,
  bucket: string,
  path: string,
): string {
  const { data } = supa.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function inferKind(path: string, mime?: string): EvidenceRef["kind"] {
  const p = path.toLowerCase();
  const m = (mime || "").toLowerCase();
  if (p.includes("aadhaar") || p.includes("passport") || p.includes("gov") || p.includes("id"))
    return "id_government";
  if (p.includes("selfie")) return "id_selfie_match";
  if (m.includes("image")) return p.includes("selfie") ? "id_selfie_match" : "id_government";
  return "authority_letter";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
    }

    const supa = getAdmin();
    const bucket = "authz";

    // 1) Load authz row
    const { data: row, error: rowErr } = await supa
      .from("authorizations")
      .select("*")
      .eq("id", id)
      .single();
    if (rowErr || !row) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // 2) Load files
    const { data: frows, error: filesErr } = await supa
      .from("authorization_files")
      .select("*")
      .eq("authorization_id", id)
      .order("created_at", { ascending: true });
    if (filesErr) {
      throw new Error(`authz_files_list_failed:${filesErr.message}`);
    }

    // 3) Map to EvidenceRef[]
    const evidence: EvidenceRef[] = (frows || []).map((f: any) => {
      const url = publicUrl(supa, bucket, f.path);
      const label = String(f.path).split("/").pop() || f.path;
      const kind = inferKind(f.path, f.mime);
      return { kind, label, url };
    });

    // 4) Rebuild manifest
    const manifest = buildAuthorizationManifest({
      record: row as AuthorizationRecord,
      files: evidence,
    }) as any;

    // 5) Return JSON
    return NextResponse.json({ ok: true, manifest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
