// src/lib/compliance/authorization.ts
// DPDP-aligned authorization & KYC artifacts for acting on behalf of a Data Principal.

export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

type ISODate = string;

export type IdentityDocType = "Aadhaar-last4" | "PAN-last4" | "Passport-last4" | "Other";

export type KycArtifact = {
  kind: IdentityDocType;
  valueMasked: string; // never store raw PII; e.g., "****1234"
  uploadedAt: ISODate;
};

export type AuthorizationRecord = {
  id: string; // UUID
  tenantId: string;
  subjectUserId: string; // internal user id (your auth)
  subjectFullName: string;
  subjectEmail?: string | null;
  subjectPhone?: string | null;

  // LoA basics
  loaSignedUrl: string;     // signed PDF/image URL (Supabase storage or external)
  loaSignedAt: ISODate;
  loaVersion: string;       // template version

  // KYC
  kyc: KycArtifact[];

  // Optional scope (controllers/sites)
  scopeControllers?: string[] | null;

  // Integrity
  manifestHash: string;     // hex sha256 of canonical manifest JSON
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type PutAuthorizationInput = {
  tenantId: string;
  subjectUserId: string;
  subjectFullName: string;
  subjectEmail?: string | null;
  subjectPhone?: string | null;
  loaSignedUrl: string;
  loaVersion?: string;
  kyc?: KycArtifact[];
  scopeControllers?: string[] | null;
};

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function nowIso(): ISODate {
  return new Date().toISOString();
}

function sha256Hex(s: string) {
  // small inline SHA256 using Web Crypto (available in Node 18+)
  const enc = new TextEncoder().encode(s);
  // @ts-ignore
  const d = require("crypto").createHash("sha256").update(enc).digest("hex");
  return d;
}

// Canonical manifest we can attach to outbound requests as proof-of-authorization.
export function buildAuthorizationManifest(rec: Omit<AuthorizationRecord, "manifestHash" | "createdAt" | "updatedAt">) {
  const canonical = {
    version: "loa.manifest.v1",
    tenantId: rec.tenantId,
    subject: {
      userId: rec.subjectUserId,
      name: rec.subjectFullName,
      email: rec.subjectEmail ?? null,
      phone: rec.subjectPhone ?? null,
    },
    loa: {
      url: rec.loaSignedUrl,
      signedAt: rec.loaSignedAt,
      templateVersion: rec.loaVersion,
    },
    kyc: rec.kyc,
    scopeControllers: rec.scopeControllers ?? null,
  };
  const manifest = JSON.stringify(canonical);
  const hash = sha256Hex(manifest);
  return { manifest, hash };
}

export async function putAuthorization(input: PutAuthorizationInput): Promise<AuthorizationRecord> {
  const sb = supabaseAdmin();

  const base = {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    subjectUserId: input.subjectUserId,
    subjectFullName: input.subjectFullName,
    subjectEmail: input.subjectEmail ?? null,
    subjectPhone: input.subjectPhone ?? null,
    loaSignedUrl: input.loaSignedUrl,
    loaSignedAt: nowIso(),
    loaVersion: input.loaVersion ?? "v1",
    kyc: input.kyc ?? [],
    scopeControllers: input.scopeControllers ?? null,
  } as const;

  const { manifest, hash } = buildAuthorizationManifest(base as any);

  const rec: AuthorizationRecord = {
    ...(base as any),
    manifestHash: hash,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  // Persist (expects a table 'authorization'—see SQL migration below)
  const { error } = await sb.from("authorization").insert({
    id: rec.id,
    tenant_id: rec.tenantId,
    subject_user_id: rec.subjectUserId,
    subject_full_name: rec.subjectFullName,
    subject_email: rec.subjectEmail,
    subject_phone: rec.subjectPhone,
    loa_signed_url: rec.loaSignedUrl,
    loa_signed_at: rec.loaSignedAt,
    loa_version: rec.loaVersion,
    kyc: rec.kyc,
    scope_controllers: rec.scopeControllers,
    manifest_hash: rec.manifestHash,
    created_at: rec.createdAt,
    updated_at: rec.updatedAt,
  });

  if (error) {
    throw new Error(`authorization_insert_failed:${error.message}`);
  }

  return rec;
}
