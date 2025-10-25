// src/lib/authz/manifest.ts
import crypto from "node:crypto";
import type { AuthorizationManifest, AuthorizationRecord, AuthorizationFileRecord, SubjectProfile } from "./types";

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function canonicalContent(input: {
  authorizationId: string;
  subject: SubjectProfile;
  consentText: string;
  signerName: string;
  signedAt: string;
  region: string | null;
  evidenceFiles: Array<{ path: string; mime: string; bytes: number }>;
}) {
  // Produce a stable JSON structure (sorted keys implicitly by writing them explicitly).
  return {
    version: "authz.v1" as const,
    authorizationId: input.authorizationId,
    subject: {
      subjectId: input.subject.subjectId ?? null,
      fullName: input.subject.fullName,
      email: input.subject.email ?? null,
      phone: input.subject.phone ?? null,
      region: input.subject.region ?? null,
    },
    consentText: input.consentText,
    signerName: input.signerName,
    signedAt: input.signedAt,
    region: input.region,
    evidenceFiles: input.evidenceFiles.map((f) => ({
      path: f.path,
      mime: f.mime,
      bytes: f.bytes,
    })),
  };
}

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function hmacSha256B64Url(message: string, key: string): string {
  const mac = crypto.createHmac("sha256", key).update(message).digest();
  return toBase64Url(mac);
}

/**
 * Build a signed manifest for an authorization.
 * - contentHash is SHA-256 of canonical JSON (no signature)
 * - signature is HMAC-SHA256 over that canonical JSON using SIGNING_BACKEND
 */
export function buildAuthorizationManifest(args: {
  record: AuthorizationRecord;
  files: AuthorizationFileRecord[];
}): AuthorizationManifest {
  const content = canonicalContent({
    authorizationId: args.record.id,
    subject: {
      subjectId: args.record.subject_id ?? undefined,
      fullName: args.record.subject_full_name,
      email: args.record.subject_email ?? undefined,
      phone: args.record.subject_phone ?? undefined,
      region: args.record.region ?? undefined,
    },
    consentText: args.record.consent_text,
    signerName: args.record.signer_name,
    signedAt: args.record.signed_at,
    region: args.record.region,
    evidenceFiles: args.files.map((f) => ({ path: f.path, mime: f.mime, bytes: f.bytes })),
  });

  const canonical = JSON.stringify(content);
  const contentHash = sha256Hex(canonical);
  const key = process.env.SIGNING_BACKEND || "";
  if (!key) {
    // We keep a safe fallback: unsigned with value="" (still deterministic hash)
    return {
      ...(content as any),
      contentHash,
      signature: {
        alg: "HMAC-SHA256",
        kid: "SIGNING_BACKEND",
        value: "",
      },
    };
  }
  const sig = hmacSha256B64Url(canonical, key);
  return {
    ...(content as any),
    contentHash,
    signature: {
      alg: "HMAC-SHA256",
      kid: "SIGNING_BACKEND",
      value: sig,
    },
  };
}
