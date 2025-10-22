// src/lib/proofs/verify.ts
import JSZip from "jszip";
import { createVerify, createHash, constants } from "node:crypto";
import * as ed25519 from "@noble/ed25519";

type Manifest = {
  schema: "unlistin.proofpack.manifest@v1";
  subjectId: string;
  createdAt: string;
  signer: {
    backend: string; // "local-ed25519" | "aws-kms" | ...
    keyId: string;
    alg: "ed25519" | "rsa-pss-sha256";
  };
  assets: {
    filename: "pack.zip";
    sha256: string; // hex digest
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

/**
 * Minimal DER TLV reader (with strict bounds checks).
 * Throws on malformed / truncated input.
 */
function readTLV(buf: Uint8Array, off: number) {
  if (off < 0 || off + 2 > buf.length) {
    throw new Error("DER truncated at header");
  }
  const tag = buf[off]!;
  const firstLen = buf[off + 1]!;
  let len = 0;
  let lenByteCount = 0;

  if ((firstLen & 0x80) === 0) {
    // short form
    len = firstLen;
    lenByteCount = 1;
  } else {
    // long form
    const n = firstLen & 0x7f;
    if (n === 0) throw new Error("Indefinite length not supported");
    if (off + 2 + n > buf.length) throw new Error("DER truncated at length");
    lenByteCount = 1 + n;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc = (acc << 8) | buf[off + 2 + i]!;
    }
    len = acc;
  }

  const header = 1 + lenByteCount;
  const start = off + header;
  const end = start + len;
  if (end > buf.length) throw new Error("DER value truncated");

  return { tag, length: len, header, start, end };
}

/**
 * SPKI (RFC 8410) Ed25519 public key is stored as a BIT STRING (tag 0x03):
 *   - content[0] = 0 (unused bits)
 *   - content[1..32] = raw 32-byte public key
 * We scan DER for a suitable BIT STRING and return the 32 raw bytes.
 */
function findSpkiBitStringKey(der: Uint8Array): Uint8Array | null {
  let off = 0;
  let candidate: Uint8Array | null = null;

  while (off < der.length) {
    let tlv;
    try {
      tlv = readTLV(der, off);
    } catch {
      // malformed remainder; stop scanning
      break;
    }

    if (tlv.tag === 0x03) {
      const bitstr = der.subarray(tlv.start, tlv.end);
      // Expect 0 unused bits + 32 bytes key
      if (bitstr.length >= 33 && bitstr[0] === 0x00) {
        const raw = bitstr.subarray(1);
        if (raw.length === 32) {
          candidate = new Uint8Array(raw);
          // Keep scanning for robustness, but this is usually the one.
        }
      }
    }

    // Advance to next TLV
    off = tlv.end;
  }

  return candidate;
}

async function verifyRsaPssSha256(
  pubKeyPem: string,
  message: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  const v = createVerify("sha256");
  v.update(message);
  v.end();
  return v.verify(
    { key: pubKeyPem, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
    signature
  );
}

async function verifyEd25519(
  pubKeyPemOrRaw: string | Uint8Array,
  message: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  let raw: Uint8Array | null = null;

  if (pubKeyPemOrRaw instanceof Uint8Array) {
    raw = pubKeyPemOrRaw;
  } else {
    const pem = pubKeyPemOrRaw.trim();
    const match = pem.match(/-----BEGIN PUBLIC KEY-----([\s\S]+?)-----END PUBLIC KEY-----/);
    if (!match || !match[1]) return false;

    const b64 = match[1].replace(/\s+/g, "");
    const derBuf = Buffer.from(b64, "base64");
    const der = new Uint8Array(derBuf.buffer, derBuf.byteOffset, derBuf.byteLength);

    raw = findSpkiBitStringKey(der);
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
    if (!publicKeyPem) {
      return { ok: false, reason: "missing_public_key_pem", manifest, recomputedSha256: recomputed };
    }
    ok = await verifyRsaPssSha256(publicKeyPem, manifestBytes, signature);
  } else if (alg === "ed25519") {
    if (!publicKeyPem) {
      return { ok: false, reason: "missing_public_key_pem", manifest, recomputedSha256: recomputed };
    }
    ok = await verifyEd25519(publicKeyPem, manifestBytes, signature);
  } else {
    return { ok: false, reason: "unknown_alg", manifest, recomputedSha256: recomputed };
  }

  return ok
    ? { ok: true, manifest, recomputedSha256: recomputed }
    : { ok: false, reason: "signature_invalid", manifest, recomputedSha256: recomputed };
}
