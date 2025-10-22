// src/lib/proofs/verify.ts
import JSZip from "jszip";
import { createVerify, createHash } from "node:crypto";
import * as ed25519 from "@noble/ed25519";

type Manifest = {
  schema: "unlistin.proofpack.manifest@v1";
  subjectId: string;
  createdAt: string;
  signer: {
    backend: string; // "local-ed25519" | "aws-kms"
    keyId: string;
    alg: "ed25519" | "rsa-pss-sha256";
  };
  assets: {
    filename: "pack.zip";
    sha256: string; // hex
    size: number;
  };
  meta?: Record<string, any>;
};

export type VerifyResult = {
  ok: boolean;
  reason?: string;
  manifest?: Manifest;
  recomputedSha256?: string; // of pack.zip
};

function sha256Hex(u8: Uint8Array): string {
  const h = createHash("sha256");
  h.update(u8);
  return h.digest("hex");
}

function u8(ab: ArrayBuffer): Uint8Array {
  return new Uint8Array(ab);
}

async function verifyRsaPssSha256(pubKeyPem: string, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
  const v = createVerify("sha256");
  v.update(message);
  v.end();
  return v.verify(
    { key: pubKeyPem, padding: (require("node:crypto") as any).constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
    signature
  );
}

async function verifyEd25519(pubKeyPemOrRaw: string | Uint8Array, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
  // Accept PEM or raw 32-byte hex/base64? Here we expect PEM.
  let raw: Uint8Array | null = null;

  if (pubKeyPemOrRaw instanceof Uint8Array) {
    raw = pubKeyPemOrRaw;
  } else {
    const pem = pubKeyPemOrRaw.trim();
    // Basic PEM → DER extraction
    const match = pem.match(/-----BEGIN PUBLIC KEY-----([A-Za-z0-9+\/=\n\r]+)-----END PUBLIC KEY-----/);
    if (!match) return false;
    const der = Buffer.from(match[1].replace(/\s+/g, ""), "base64");

    // Poor-man’s SubjectPublicKeyInfo parser to extract 32-byte Ed25519 key:
    // Ed25519 OID = 1.3.101.112; DER layout varies, but the last OCTET STRING should be the 32-byte key.
    // A robust parser is overkill—look for the final 0x04 (OCTET STRING) and slice that.
    let i = 0;
    while (i < der.length) {
      if (der[i] === 0x04 && i + 2 < der.length) {
        const len = der[i + 1] & 0x7f
        let offset = 2;
        let size = der[i + 1];
        if (len === 0x81) { size = der[i + 2]; offset = 3; }
        else if (len === 0x82) { size = (der[i + 2] << 8) | der[i + 3]; offset = 4; }
        const start = i + offset;
        const end = start + size;
        const candidate = der.slice(start, end);
        if (candidate.length === 32) {
          raw = u8(candidate.buffer.slice(candidate.byteOffset, candidate.byteOffset + candidate.byteLength));
          break;
        }
      }
      i++;
    }
  }

  if (!raw || raw.length !== 32) return false;
  return ed25519.verify(signature, message, raw);
}

export async function verifySignedBundle(bundleBytes: Uint8Array): Promise<VerifyResult> {
  // 1) Open zip
  const zip = await JSZip.loadAsync(bundleBytes);

  const manifestEntry = zip.file("manifest.json");
  const sigEntry = zip.file("signature.bin");
  const packEntry = zip.file("pack.zip");
  if (!manifestEntry || !sigEntry || !packEntry) {
    return { ok: false, reason: "missing_required_files" };
  }

  // 2) Extract files
  const manifestBytes = u8(await manifestEntry.async("arraybuffer"));
  const signature = u8(await sigEntry.async("arraybuffer"));
  const packU8 = u8(await packEntry.async("arraybuffer"));

  // 3) Parse manifest
  let manifest: Manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    return { ok: false, reason: "invalid_manifest_json" };
  }

  if (manifest.schema !== "unlistin.proofpack.manifest@v1") {
    return { ok: false, reason: "manifest_schema_mismatch" };
  }

  // 4) Check pack hash matches manifest
  const recomputed = sha256Hex(packU8);
  if (recomputed !== manifest.assets.sha256) {
    return { ok: false, reason: "pack_hash_mismatch", manifest, recomputedSha256: recomputed };
  }

  // 5) Load public key if present (optional)
  let publicKeyPem: string | undefined;
  const pubEntry = zip.file("public_key.pem");
  if (pubEntry) {
    publicKeyPem = new TextDecoder().decode(await pubEntry.async("uint8array"));
  }

  // 6) Verify manifest signature
  const alg = manifest.signer.alg;
  let ok = false;

  if (alg === "rsa-pss-sha256") {
    if (!publicKeyPem) return { ok: false, reason: "missing_public_key_pem", manifest, recomputedSha256: recomputed };
    ok = await verifyRsaPssSha256(publicKeyPem, manifestBytes, signature);
  } else if (alg === "ed25519") {
    if (!publicKeyPem) return { ok: false, reason: "missing_public_key_pem", manifest, recomputedSha256: recomputed };
    ok = await verifyEd25519(publicKeyPem, manifestBytes, signature);
  } else {
    return { ok: false, reason: "unknown_alg", manifest, recomputedSha256: recomputed };
  }

  return ok ? { ok: true, manifest, recomputedSha256: recomputed } :
              { ok: false, reason: "signature_invalid", manifest, recomputedSha256: recomputed };
}
