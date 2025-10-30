// app/ops/authz/[id]/attach/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildAuthorizationManifest } from "@/src/lib/authz/manifest";
import type { AuthorizationRecord } from "@/src/lib/authz/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const EVIDENCE_BUCKET = "authz";
// Soft safety limits (server-side only; adjust if needed)
const MAX_FILES = 24;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024; // 32MB

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("supabase_admin_missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeName(name: string) {
  // keep dots & dashes; remove other unsafe chars
  const base = name?.split("/").pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 140);
}

function inferEvidenceKind(path: string, mime: string): EvidenceRef["kind"] {
  const n = (path || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (n.includes("aadhaar") || n.includes("passport") || n.includes("gov") || n.includes("id")) return "id_government";
  if (n.includes("selfie")) return "id_selfie_match";
  if (n.includes("consent") || n.includes("authority") || n.includes("letter")) return "authority_letter";
  if (n.includes("receipt") || n.includes("invoice")) return "purchase_receipt";
  if (n.includes("otp") || n.includes("sms")) return "phone_otp";
  if (n.includes("email") || m.includes("message/rfc822")) return "email_control";
  if (m.includes("image")) return n.includes("selfie") ? "id_selfie_match" : "id_government";
  return "authority_letter";
}

async function putFile(
  supa: ReturnType<typeof getAdmin>,
  bucket: string,
  path: string,
  bytes: Uint8Array,
  mime: string
) {
  const { data, error } = await supa.storage.from(bucket).upload(path, bytes, {
    contentType: mime || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`storage_upload_failed:${error.message}`);
  return data.path;
}

function publicUrl(supa: ReturnType<typeof getAdmin>, bucket: string, path: string): string {
  const { data } = supa.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
    }

    const supa = getAdmin();

    // 1) Read existing authorization row (we only need what's required for manifest builder)
    const { data: row, error: rowErr } = await supa.from("authorizations").select("*").eq("id", id).single();
    if (rowErr || !row) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // 2) Parse multipart form (field name: "files")
    const form = await req.formData();
    const uploads = (form.getAll("files").filter(Boolean) as File[]) || [];
    if (!uploads.length) {
      // Nothing to do — just bounce back
      return NextResponse.redirect(new URL(`/ops/authz/${id}`, req.url), 303);
    }

    // Soft limits before uploading
    if (uploads.length > MAX_FILES) {
      return NextResponse.json({ ok: false, error: "too_many_files" }, { status: 400 });
    }
    let totalBytes = 0;
    for (const f of uploads) totalBytes += f.size || 0;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }

    // 3) Store each file + insert file rows
    for (const f of uploads) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const filename = safeName(f.name || "file");
      const path = `${id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${filename}`;

      const storedPath = await putFile(supa, EVIDENCE_BUCKET, path, bytes, f.type || "application/octet-stream");

      const { error: ferr } = await supa.from("authorization_files").insert([
        {
          authorization_id: id,
          path: storedPath,
          mime: f.type || "application/octet-stream",
          bytes: bytes.byteLength,
        },
      ]);
      if (ferr) throw new Error(`authz_file_insert_failed:${ferr.message}`);
    }

    // 4) Fetch all files for this authorization to compute evidence
    const { data: allFiles, error: listErr } = await supa
      .from("authorization_files")
      .select("path,mime,created_at")
      .eq("authorization_id", id)
      .order("created_at", { ascending: true });
    if (listErr) throw new Error(`authz_files_list_failed:${listErr.message}`);

    const evidence: EvidenceRef[] = (allFiles || []).map((f: any) => {
      const url = publicUrl(supa, EVIDENCE_BUCKET, f.path);
      const label = String(f.path).split("/").pop() || f.path;
      const kind = inferEvidenceKind(f.path, f.mime || "");
      return { kind, label, url };
    });

    // 5) Rebuild manifest + update manifest_hash (resilient to shapes)
    let manifest: any;
    try {
      manifest = buildAuthorizationManifest({
        record: row as AuthorizationRecord,
        files: evidence,
      });
    } catch (e: any) {
      // If the builder supports a different signature, try the plain `{ manifest }` shape as a fallback
      manifest = (evidence && row)
        ? buildAuthorizationManifest({ manifest: { record: row, files: evidence } } as any)
        : null;
    }

    const hashHex =
      manifest?.integrity?.hashHex ??
      manifest?.hashHex ??
      manifest?.integrityHash ??
      "";

    if (!hashHex) {
      // We still proceed, but mark a clear error message for visibility
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "authz_manifest_hash_missing",
          id,
        })
      );
    }

    const { error: updErr } = await supa.from("authorizations").update({ manifest_hash: hashHex || null }).eq("id", id);
    if (updErr) throw new Error(`authz_manifest_hash_update_failed:${updErr.message}`);

    // 6) Redirect back to the detail page
    return NextResponse.redirect(new URL(`/ops/authz/${id}`, req.url), 303);
  } catch (e: any) {
    // Minimal JSON error; useful for debugging with curl
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
