// src/lib/authz/manifest.ts
// Authorization & KYC Manifest for DPDP/GDPR-style agenting.
// Pure compute (no DB) so it's safe in server routes and tests.

import { signIfEnabled, stableStringify } from "@/src/lib/crypto/sign";
import crypto from "node:crypto";

export type EvidenceRef = {
  kind:
    | "authority_letter"   // LoA / PoA pdf/img
    | "id_government"      // Govt ID doc image/pdf
    | "id_selfie_match"    // Selfie/live check receipt
    | "email_control"      // Proof of mailbox control
    | "phone_otp";         // Proof of phone number control
  url?: string | null;      // optional link to stored artifact (presigned URL, etc.)
  notes?: string | null;
};

export type Permission =
  | "erasure"
  | "access"
  | "rectification"
  | "restrict_processing"
  | "objection"
  | "do_not_sell"
  | "do_not_share"
  | "data_portability";

export type Subject = {
  id?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  handles?: string[] | null;
};

export type Agent = {
  name: string;           // e.g., "UnlistIN"
  website?: string | null;
  contactEmail?: string | null;
};

export type AuthorizationManifest = {
  schema: "unlistin.authz.manifest.v1";
  subject: Subject;
  agent: Agent;
  region: string;         // e.g., "IN", "EU", "US-CA"
  permissions: Permission[];
  evidence: EvidenceRef[];
  createdAt: string;      // ISO
  expiresAt?: string | null;
  integrity: {
    hashAlg: "sha256";
    hashHex: string;      // sha256 over canonical subset (see computeHashInput)
  };
  signature: {
    present: boolean;
    value: {
      alg: "HS256";
      keyId: "local-hmac";
      sigHex: string;
    } | null;
    note?: string | null; // why missing, etc.
  };
};

export type CreateManifestInput = {
  subject: Subject;
  region: string;              // ISO-like (IN / EU / US-CA / etc.)
  permissions: Permission[];
  evidence?: EvidenceRef[];    // LoA + ID proof suggested
  expiresInDays?: number | null;
  agent?: Partial<Agent> | null;
};

function defaultAgent(): Agent {
  return {
    name: "UnlistIN",
    website: null,
    contactEmail: null,
  };
}

function toISODate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

function computeHashInput(m: Omit<AuthorizationManifest, "integrity" | "signature">) {
  // Only hash the stable, material parts (not signature/integrity)
  return {
    schema: m.schema,
    subject: m.subject,
    agent: m.agent,
    region: m.region,
    permissions: m.permissions.slice().sort(),
    evidence: (m.evidence || []).map((e) => ({ kind: e.kind, url: e.url ?? null })),
    createdAt: m.createdAt,
    expiresAt: m.expiresAt ?? null,
  };
}

export function createAuthorizationManifest(input: CreateManifestInput): AuthorizationManifest {
  const now = new Date();
  const exp =
    typeof input.expiresInDays === "number" && input.expiresInDays > 0
      ? new Date(now.getTime() + input.expiresInDays * 86400 * 1000)
      : null;

  const base: Omit<AuthorizationManifest, "integrity" | "signature"> = {
    schema: "unlistin.authz.manifest.v1",
    subject: {
      id: input.subject.id ?? null,
      fullName: input.subject.fullName,
      email: input.subject.email ?? null,
      phone: input.subject.phone ?? null,
      handles: input.subject.handles ?? null,
    },
    agent: {
      ...defaultAgent(),
      ...(input.agent || {}),
    },
    region: (input.region || "IN").toUpperCase(),
    permissions: Array.from(new Set(input.permissions || [])).sort(),
    evidence: (input.evidence || []).map((e) => ({
      kind: e.kind,
      url: e.url ?? null,
      notes: e.notes ?? null,
    })),
    createdAt: toISODate(now),
    expiresAt: exp ? toISODate(exp) : null,
  };

  const hashInput = computeHashInput(base);
  const hashHex = crypto.createHash("sha256").update(stableStringify(hashInput)).digest("hex");

  const sig = signIfEnabled({
    type: "unlistin.authz.manifest.v1",
    hashAlg: "sha256",
    hashHex,
  });

  const signature =
    sig
      ? { present: true, value: sig, note: null }
      : {
          present: false,
          value: null,
          note:
            (process.env.SIGNING_BACKEND || "").trim()
              ? "Signing backend configured but unavailable; proceeding unsigned."
              : "Signing disabled; set SIGNING_BACKEND=local-hmac and SIGNING_SECRET to enable.",
        };

  return {
    ...base,
    integrity: { hashAlg: "sha256", hashHex },
    signature,
  };
}
