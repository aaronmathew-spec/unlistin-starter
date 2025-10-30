/* src/lib/authz/evidence.ts
 * Shared helper to attach evidence files to an Authorization and recompute manifest hash.
 * - Uses Supabase SERVICE ROLE on the server (bypasses RLS safely within backend).
 * - Uploads to public bucket `authz/` with a stable path per authorization.
 * - Inserts rows into `authorization_files`.
 * - Rebuilds the Authorization Manifest using resilient import (multiple export names supported).
 * - Updates `authorizations.manifest_hash`.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

type Supa = ReturnType<typeof createClient>;

type MinimalAuthzRecord = {
  id: number | string;
  subject_full_name?: string | null;
  consent_text?: string | null;
  manifest_hash?: string | null;
};

type AuthorizationFileRow = {
  id: number;
  authorization_id: number;
  name: string;
  url: string | null;
  bucket: string | null;
  path: string | null;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

/**
 * Local insert shape to satisfy TS without generated Supabase types.
 * Parameterizing `.from<AuthorizationFileInsert>()` avoids `never` inference.
 */
type AuthorizationFileInsert = {
  authorization_id: number | string;
  name: string;
  url: string | null;
  bucket: string;
  path: string;
  mime: string | null;
  size_bytes: number | null;
};

type AttachResult = {
  record: MinimalAuthzRecord;
  files: AuthorizationFileRow[];
  manifest: any;
  manifestHashHex: string;
};

const BUCKET = "authz"; // public bucket per your repo convention

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

// Build a service-role Supabase client (server-only)
export function getServiceSupabase(): Supa {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE"), {
    auth: { persistSession: false },
  });
}

/** Best-effort hex digest for manifest integrity when builder doesn't supply it. */
function sha256Hex(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Resiliently import the manifest builder from your codebase. */
async function loadManifestBuilder(): Promise<{
  build: (input: any) => Promise<any> | any;
}> {
  const candidates = [
    "@/src/lib/authz/manifest",
    "@/lib/authz/manifest",
    "@/src/lib/manifest",
    "@/lib/manifest",
  ];

  for (const p of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const mod: any = await import(p);
      const fns = [
        "createAuthorizationManifest",
        "buildAuthorizationManifest",
        "createAuthorizationBundle", // may return { manifest }
        "default",
      ];
      for (const name of fns) {
        const fn = mod?.[name];
        if (typeof fn === "function") {
          return {
            build: async (input: any) => {
              const out = await Promise.resolve(fn(input));
              // unwrap bundle if needed
              if (out && typeof out === "object" && "manifest" in out && out.manifest) {
                return out.manifest;
              }
              return out;
            },
          };
        }
      }
    } catch {
      // continue searching
    }
  }
  throw new Error("Authorization manifest builder not found");
}

/** Basic filename sanitizer for storage keys. */
function safeName(name: string) {
  const base = (name || "").split("/").pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 140);
}

/**
 * Attach evidence files and recompute manifest hash.
 * @param db Supabase service client
 * @param authorizationId number|string
 * @param files Array of incoming files (from FormData) – { name, type, size, arrayBuffer() }
 */
export async function attachAuthorizationEvidence(
  db: Supa,
  authorizationId: number | string,
  files: Array<File>
): Promise<AttachResult> {
  // 0) Load authz record (minimal)
  const { data: authz, error: aErr } = await db
    .from("authorizations")
    .select("id, subject_full_name, consent_text, manifest_hash")
    .eq("id", authorizationId)
    .single();

  if (aErr || !authz) {
    throw new Error(`Authorization not found: ${authorizationId}`);
  }

  const uploaded: AuthorizationFileRow[] = [];

  // 1) Upload each file to storage and insert DB row
  for (const f of files) {
    const name = safeName(
      f.name || `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    const mime = (f as any).type || null;
    const size = Number.isFinite((f as any).size) ? Number((f as any).size) : null;

    const path = `${String(authorizationId)}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${name}`;
    const ab = await f.arrayBuffer();

    // upload
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, ab, {
      upsert: false,
      contentType: mime || undefined,
    });
    if (upErr) throw new Error(`storage_upload_failed: ${upErr.message}`);

    // get public URL (bucket is public by convention)
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);

    // insert DB row (NOTE the generic <AuthorizationFileInsert> to fix TS)
    const { data: row, error: iErr } = await db
      .from<AuthorizationFileInsert>("authorization_files")
      .insert({
        authorization_id: authz.id,
        name,
        url: pub?.publicUrl ?? null,
        bucket: BUCKET,
        path,
        mime,
        size_bytes: size,
      })
      .select(
        "id, authorization_id, name, url, bucket, path, mime, size_bytes, created_at"
      )
      .single();

    if (iErr || !row) throw new Error(`insert_file_failed: ${iErr?.message}`);
    uploaded.push(row as unknown as AuthorizationFileRow);
  }

  // 2) Rebuild manifest from current state (authz + all files)
  const { data: allFiles, error: lfErr } = await db
    .from("authorization_files")
    .select("id, authorization_id, name, url, bucket, path, mime, size_bytes, created_at")
    .eq("authorization_id", authz.id)
    .order("created_at", { ascending: true });

  if (lfErr) throw new Error(`load_files_failed: ${lfErr.message}`);

  const builder = await loadManifestBuilder();

  // Construct a minimal input that most builder variants can handle.
  const manifestInput = {
    authorization: {
      id: authz.id,
      subject: { fullName: authz.subject_full_name ?? null },
      consent: { text: authz.consent_text ?? null },
    },
    evidence: (allFiles || []).map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      mime: r.mime,
      bytes: r.size_bytes,
      createdAt: r.created_at,
      // Kind inference could be added here if your builder expects it.
    })),
  };

  const manifest = await builder.build(manifestInput);

  // 3) Compute manifest hash (use provided integrity.hashHex or fallback)
  let manifestHashHex: string | null = null;
  try {
    manifestHashHex =
      manifest?.integrity?.hashHex ?? sha256Hex(Buffer.from(JSON.stringify(manifest)));
  } catch {
    // final fallback: hash of current time (should practically never happen)
    manifestHashHex = sha256Hex(`${authz.id}:${Date.now()}`);
  }

  // 4) Update authorizations.manifest_hash
  const { data: updated, error: uErr } = await db
    .from("authorizations")
    .update({ manifest_hash: manifestHashHex })
    .eq("id", authz.id)
    .select("id, subject_full_name, consent_text, manifest_hash")
    .single();

  if (uErr || !updated) throw new Error(`update_manifest_hash_failed: ${uErr?.message}`);

  return {
    record: updated as MinimalAuthzRecord,
    files: uploaded,
    manifest,
    manifestHashHex: manifestHashHex!,
  };
}
