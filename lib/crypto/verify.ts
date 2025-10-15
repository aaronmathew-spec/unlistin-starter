// lib/crypto/verify.ts
/**
 * Signature verification utilities for proof_ledger records.
 * - Supports local ed25519 (public from SIGNING_PUBLIC_KEY_PEM or derived from private)
 * - Supports AWS KMS RSA-PSS-2048-SHA256 (public fetched via GetPublicKey or provided in env)
 * - Build-safe: AWS SDK loaded dynamically at runtime when needed
 */

import crypto from "node:crypto";

const BACKEND = (process.env.SIGNING_BACKEND || "local-ed25519").toLowerCase();
const LOCAL_PRIVATE_PEM = process.env.SIGNING_PRIVATE_KEY_PEM || "";
const PUBLIC_PEM_ENV = process.env.SIGNING_PUBLIC_KEY_PEM || "";
const AWS_REGION = process.env.AWS_REGION || "";
const AWS_KMS_KEY_ID = process.env.AWS_KMS_KEY_ID || "";

type Algo = "ed25519" | "rsa-pss-sha256";

export type LedgerRow = {
  id: string;
  root_hex: string;
  algorithm: Algo;
  key_id: string;
  signature_b64: string;
};

/** Avoid bundler resolution of AWS SDK at build-time */
async function dynamicImport(moduleName: string): Promise<any> {
  // eslint-disable-next-line no-new-func
  const importer = new Function("m", "return import(m);");
  return importer(moduleName);
}

/** Cached KMS SPKI public key PEM (if fetched) */
let _kmsPublicPem: string | null = null;

/** Convert DER (SPKI) to PEM */
function derToPemSpki(der: Buffer): string {
  const b64 = der.toString("base64");
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`;
}

/** Get public key PEM for current backend */
export async function getPublicKeyPem(): Promise<string> {
  // Prefer explicit env if provided (works for both ed25519 and RSA)
  if (PUBLIC_PEM_ENV.trim()) return PUBLIC_PEM_ENV.trim();

  if (BACKEND === "local-ed25519") {
    // Derive public from private if available
    if (!LOCAL_PRIVATE_PEM.trim()) {
      throw new Error("Missing SIGNING_PRIVATE_KEY_PEM or SIGNING_PUBLIC_KEY_PEM for local-ed25519 verification");
    }
    const priv = crypto.createPrivateKey(LOCAL_PRIVATE_PEM.trim());
    const pub = crypto.createPublicKey(priv);
    return pub.export({ type: "spki", format: "pem" }).toString();
  }

  if (BACKEND === "aws-kms") {
    if (_kmsPublicPem) return _kmsPublicPem;
    // Try to fetch from KMS
    if (!AWS_REGION || !AWS_KMS_KEY_ID) {
      throw new Error("AWS_REGION / AWS_KMS_KEY_ID missing for aws-kms verification");
    }
    let GetPublicKey: any, KMS: any;
    try {
      const mod = await dynamicImport("@aws-sdk/client-kms");
      KMS = mod.KMS;
      GetPublicKey = mod.GetPublicKeyCommand;
    } catch {
      throw new Error("To verify with aws-kms, install @aws-sdk/client-kms");
    }
    const kms = new KMS({ region: AWS_REGION });
    const out = await kms.send(new GetPublicKey(AWS_KMS_KEY_ID));
    const der = Buffer.from(out.PublicKey ?? new Uint8Array(0));
    if (!der.length) throw new Error("KMS returned empty public key");
    _kmsPublicPem = derToPemSpki(der);
    return _kmsPublicPem;
  }

  throw new Error(`Unsupported backend: ${BACKEND}`);
}

function verifyEd25519(message: Uint8Array, signatureB64: string, publicPem: string): boolean {
  const sig = Buffer.from(signatureB64, "base64");
  return crypto.verify(null, Buffer.from(message), publicPem, sig);
}

function verifyRsaPssSha256(message: Uint8Array, signatureB64: string, publicPem: string): boolean {
  const sig = Buffer.from(signatureB64, "base64");
  const verifier = crypto.createVerify("sha256");
  verifier.update(Buffer.from(message));
  verifier.end();
  return verifier.verify(
    { key: publicPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
    sig
  );
}

/** Verify a proof_ledger row against its root_hex */
export async function verifyLedgerRecord(row: LedgerRow): Promise<boolean> {
  const publicPem = await getPublicKeyPem();
  const message = Buffer.from(row.root_hex, "hex");

  switch (row.algorithm) {
    case "ed25519":
      return verifyEd25519(message, row.signature_b64, publicPem);
    case "rsa-pss-sha256":
      return verifyRsaPssSha256(message, row.signature_b64, publicPem);
    default:
      throw new Error(`Unknown algorithm: ${row.algorithm}`);
  }
}
