// src/lib/authz/store.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import type {
  AuthorizationInput,
  AuthorizationRecord,
  AuthorizationFileRecord,
} from "./types";
import { buildAuthorizationManifest } from "./manifest";

type AdminClient = ReturnType<typeof createClient<any, any, any>>;

/** Minimal local type the manifest builder must expose for this layer */
type AuthorizationManifestLike = {
  integrity?: { hashHex?: string } | undefined;
  // Keep flexible; we don't depend on the rest of the shape here.
  [k: string]: any;
};

/** Minimal local type the manifest builder expects for evidence files */
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

function getAdmin(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error(
      "supabase_admin_missing: please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function putFile(
  supa: AdminClient,
  bucket: string,
  path: string,
  bytes: Uint8Array,
  mime: string,
) {
  const { data, error } = await supa.storage
    .from(bucket)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`storage_upload_failed:${error.message}`);
  return data.path; // storage path (not public URL)
}

function filePublicUrl(
  supa: AdminClient,
  bucket: string,
  path: string,
): string {
  const { data } = supa.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function decodeBase64(b64: string): Uint8Array {
  return Buffer.from(b64, "base64");
}

/** Infer an EvidenceRef.kind from filename or mime if not explicitly stored. */
function inferEvidenceKind(
  file: Pick<AuthorizationFileRecord, "path" | "mime">,
): EvidenceRef["kind"] {
  const name = (file.path || "").toLowerCase();
  const mime = (file.mime || "").toLowerCase();

  if (
    name.includes("aadhaar") ||
    name.includes("passport") ||
    name.includes("gov") ||
    name.includes("id")
  ) {
    return "id_government";
  }
  if (name.includes("selfie")) return "id_selfie_match";

  if (mime.includes("image")) {
    if (name.includes("selfie")) return "id_selfie_match";
    return "id_government";
  }

  // Default to LoA if not sure
  return "authority_letter";
}

/** Map DB file rows to EvidenceRef[] expected by the manifest builder. */
function toEvidenceRefs(
  supa: AdminClient,
  bucket: string,
  files: AuthorizationFileRecord[],
): EvidenceRef[] {
  return files.map((f) => {
    const url = filePublicUrl(supa, bucket, f.path);
    const label = f.path.split("/").pop() || f.path;
    const kind = inferEvidenceKind({ path: f.path, mime: (f as any).mime });
    return { kind, label, url };
  });
}

/** Create authorization + files + manifest */
export async function createAuthorization(
  input: AuthorizationInput,
): Promise<{
  record: AuthorizationRecord;
  files: AuthorizationFileRecord[];
  manifest: AuthorizationManifestLike;
}> {
  const supa = getAdmin();
  const bucket = "authz";

  // 1) Insert authorization row
  const { data: row, error: errRow } = await supa
    .from("authorizations")
    .insert([
      {
        subject_id: input.subject.subjectId ?? null,
        subject_full_name: input.subject.fullName,
        subject_email: input.subject.email ?? null,
        subject_phone: input.subject.phone ?? null,
        region: input.subject.region ?? null,
        signer_name: input.signerName,
        signed_at: input.signedAt,
        consent_text: input.consentText,
        manifest_hash: "", // set after we compute it
      },
    ])
    .select("*")
    .single();

  if (errRow || !row) {
    throw new Error(`authz_insert_failed:${errRow?.message || "unknown"}`);
  }

  // 2) Upload artifacts to storage + file rows
  const files: AuthorizationFileRecord[] = [];
  const artifacts = input.artifacts ?? [];
  for (const a of artifacts) {
    const bytes = decodeBase64(a.base64);
    const safeName = a.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${row.id}/${Date.now()}_${safeName}`;
    const storedPath = await putFile(supa, bucket, path, bytes, a.mime);

    const { data: frow, error: ferr } = await supa
      .from("authorization_files")
      .insert([
        {
          authorization_id: row.id,
          path: storedPath,
          mime: a.mime,
          bytes: bytes.byteLength,
        },
      ])
      .select("*")
      .single();

    if (ferr || !frow) {
      throw new Error(`authz_file_insert_failed:${ferr?.message || "unknown"}`);
    }
    files.push(frow as AuthorizationFileRecord);
  }

  // 3) Build manifest (deterministic + signed)
  const evidenceRefs = toEvidenceRefs(supa, bucket, files);
  const manifest = buildAuthorizationManifest({
    record: row as AuthorizationRecord,
    files: evidenceRefs,
  }) as AuthorizationManifestLike;

  // 4) Update manifest_hash in DB (fallback gracefully if integrity/hashHex absent)
  const hashHex =
    manifest?.integrity?.hashHex ??
    // try common alternatives if builder changes shape
    (manifest as any)?.hashHex ??
    (manifest as any)?.integrityHash ??
    "";

  const { error: updErr } = await supa
    .from("authorizations")
    .update({ manifest_hash: hashHex })
    .eq("id", row.id);
  if (updErr) {
    throw new Error(`authz_manifest_hash_update_failed:${updErr.message}`);
  }

  return {
    record: { ...(row as AuthorizationRecord), manifest_hash: hashHex },
    files,
    manifest,
  };
}

export async function getAuthorization(id: string): Promise<{
  record: AuthorizationRecord | null;
  files: AuthorizationFileRecord[];
}> {
  const supa = getAdmin();
  const { data: row, error } = await supa
    .from("authorizations")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !row) return { record: null, files: [] };

  const { data: frows } = await supa
    .from("authorization_files")
    .select("*")
    .eq("authorization_id", id)
    .order("created_at", { ascending: true });

  return {
    record: row as AuthorizationRecord,
    files: (frows || []) as AuthorizationFileRecord[],
  };
}

/** Ops helper: list authorizations with simple search & paging (non-breaking) */
export async function listAuthorizations(opts?: {
  limit?: number;
  offset?: number;
  search?: string | null; // optional email/name/phone/signer search
}): Promise<{ rows: AuthorizationRecord[]; total: number }> {
  const supa = getAdmin();
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const offset = Math.max(0, opts?.offset ?? 0);
  const search = (opts?.search || "").trim();

  let q = supa
    .from("authorizations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    // Basic case-insensitive search across key columns
    q = q
      .ilike("subject_full_name", `%${search}%`)
      .or(
        [
          `subject_email.ilike.%${search}%`,
          `subject_phone.ilike.%${search}%`,
          `signer_name.ilike.%${search}%`,
        ].join(","),
      );
  }

  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(`authz_list_failed:${error.message}`);

  return {
    rows: (data || []) as AuthorizationRecord[],
    total: count ?? 0,
  };
}
