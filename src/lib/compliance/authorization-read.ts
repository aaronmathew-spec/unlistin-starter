// src/lib/compliance/authorization-read.ts
// Server-only reader for the latest authorization record + manifest synthesis.

export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import {
  buildAuthorizationManifest,
  type AuthorizationRecord,
} from "@/src/lib/compliance/authorization";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Fetch the most recent authorization for (tenantId, subjectUserId).
 * Returns the DB record plus synthesized manifest+hash.
 */
export async function resolveAuthorizationManifestFor(params: {
  tenantId: string;
  subjectUserId: string;
}): Promise<
  | (AuthorizationRecord & {
      manifest: string;
    })
  | null
> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("authorization")
    .select(
      [
        "id",
        "tenant_id",
        "subject_user_id",
        "subject_full_name",
        "subject_email",
        "subject_phone",
        "loa_signed_url",
        "loa_signed_at",
        "loa_version",
        "kyc",
        "scope_controllers",
        "manifest_hash",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("tenant_id", params.tenantId)
    .eq("subject_user_id", params.subjectUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    // Swallow and return null (non-breaking; email still sends without manifest)
    return null;
  }

  const row = (data?.[0] ?? null) as any;
  if (!row) return null;

  // Map to AuthorizationRecord (typed)
  const rec = {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    subjectUserId: String(row.subject_user_id),
    subjectFullName: String(row.subject_full_name),
    subjectEmail: row.subject_email ?? null,
    subjectPhone: row.subject_phone ?? null,
    loaSignedUrl: String(row.loa_signed_url),
    loaSignedAt: new Date(row.loa_signed_at).toISOString(),
    loaVersion: String(row.loa_version),
    kyc: Array.isArray(row.kyc) ? row.kyc : [],
    scopeControllers: row.scope_controllers ?? null,
    manifestHash: String(row.manifest_hash),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  } satisfies AuthorizationRecord;

  // Re-synthesize canonical manifest for attachment (not stored as JSON in DB)
  const { manifest, hash } = buildAuthorizationManifest({
    tenantId: rec.tenantId,
    subjectUserId: rec.subjectUserId,
    subjectFullName: rec.subjectFullName,
    subjectEmail: rec.subjectEmail,
    subjectPhone: rec.subjectPhone,
    loaSignedUrl: rec.loaSignedUrl,
    loaSignedAt: rec.loaSignedAt,
    loaVersion: rec.loaVersion,
    kyc: rec.kyc,
    scopeControllers: rec.scopeControllers,
  });

  // If DB hash differs for any reason, prefer synthesized hash in footer/attach
  return { ...rec, manifest, manifestHash: hash };
}
