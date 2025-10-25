// app/ops/authz/[id]/attach/route.ts
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildAuthorizationManifest } from "@/src/lib/authz/manifest";
import type {
  AuthorizationRecord,
  AuthorizationFileRecord,
} from "@/src/lib/authz/types";

/** Minimal EvidenceRef type expected by the manifest builder */
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

async function putFile(
  supa: ReturnType<typeof getAdmin>,
  bucket: string,
  path: string,
  bytes: Uint8Array,
  mime: string,
) {
  const { data, error } = await supa.storage
    .from(bucket)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`storage_upload_failed:${error.message}`);
  return data.path;
}

function publicUrl(
  supa: ReturnType<typeof getAdmin>,
  bucket: string,
  path: string,
): string {
  const { data } = supa.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function inferEvidenceKind(path: string, mime: string): EvidenceRef["kind"] {
  const name = path.toLowerCase();
  const m = (mime || "").toLowerCase();
  if (name.includes("aadhaar") || name.includes("passport") || name.includes("gov") || name.includes("id"))
    return "id_government";
  if (name.includes("selfie")) return "id_selfie_match";
  if (m.includes("image")) return name.includes("selfie") ? "id_selfie_match" : "id_government";
  return "authority_letter";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
    }

    const supa = getAdmin();
    const bucket = "authz";

    // 1) Read existing authorization row
    const { data: row, error: rowErr } = await supa
      .from("authorizations")
      .select("*")
      .eq("id", id)
      .single();
    if (rowErr || !row) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // 2) Parse multipart form (field name: "files")
    const form = await req.formData();
    const uploads = form.getAll("files").filter(Boolean) as File[];
    if (!uploads.length) {
      // Nothing to do — just bounce back
      return NextResponse.redirect(new URL(`/ops/authz/${id}`, req.url), 303);
    }

    // 3) Store each file + insert file rows
    const saved: AuthorizationFileRecord[] = [];
    for (const f of uploads) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${id}/${Date.now()}_${safeName}`;
      const storedPath = await putFile(supa, bucket, path, bytes, f.type || "application/octet-stream");

      const { data: frow, error: ferr } = await supa
        .from("authorization_files")
        .insert([{ authorization_id: id, path: storedPath, mime: f.type || "application/octet-stream", bytes: bytes.byteLength }])
        .select("*")
        .single();
      if (ferr || !frow) throw new Error(`authz_file_insert_failed:${ferr?.message || "unknown"}`);
      saved.push(frow as AuthorizationFileRecord);
    }

    // 4) Fetch all files for this authorization to compute evidence
    const { data: allFiles, error: listErr } = await supa
      .from("authorization_files")
      .select("*")
      .eq("authorization_id", id)
      .order("created_at", { ascending: true });
    if (listErr) throw new Error(`authz_files_list_failed:${listErr.message}`);

    const evidence: EvidenceRef[] = (allFiles || []).map((f) => {
      const url = publicUrl(supa, bucket, (f as any).path);
      const label = String((f as any).path).split("/").pop() || (f as any).path;
      const kind = inferEvidenceKind((f as any).path, (f as any).mime || "");
      return { kind, label, url };
    });

    // 5) Rebuild manifest + update manifest_hash
    const manifest = buildAuthorizationManifest({
      record: row as AuthorizationRecord,
      files: evidence,
    }) as any;

    const hashHex =
      manifest?.integrity?.hashHex ??
      manifest?.hashHex ??
      manifest?.integrityHash ??
      "";

    const { error: updErr } = await supa
      .from("authorizations")
      .update({ manifest_hash: hashHex })
      .eq("id", id);
    if (updErr) throw new Error(`authz_manifest_hash_update_failed:${updErr.message}`);

    // 6) Redirect back to the detail page
    return NextResponse.redirect(new URL(`/ops/authz/${id}`, req.url), 303);
  } catch (e: any) {
    // Show a minimal JSON error (useful when testing with curl)
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
