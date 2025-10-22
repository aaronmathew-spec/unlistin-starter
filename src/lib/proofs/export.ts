// src/lib/proofs/export.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import JSZip from "jszip";
import { createHash } from "crypto";
import { getSigner } from "@/lib/signing";
import { buildProofPack } from "@/lib/proofs/pack"; // returns Uint8Array or ArrayBuffer

type Manifest = {
  schema: "unlistin.proofpack.manifest@v1";
  subjectId: string;
  createdAt: string; // ISO8601
  signer: {
    backend: string; // SIGNING_BACKEND (no alg here; alg is in signature.json)
    keyId: string;
  };
  assets: {
    filename: "pack.zip";
    sha256: string; // hex sha256 of pack.zip
    size: number;   // bytes
  };
  meta?: Record<string, any>;
};

function ensureU8(x: Uint8Array | ArrayBuffer | ArrayBufferLike): Uint8Array {
  if (x instanceof Uint8Array) return x;
  return new Uint8Array(x as ArrayBufferLike);
}

function sha256Hex(u8: Uint8Array): string {
  const h = createHash("sha256");
  h.update(u8);
  return h.digest("hex");
}

/**
 * Build a signed export bundle (.zip) with:
 * - pack.zip         (raw bytes of your proof pack)
 * - manifest.json    (deterministic metadata; stable bytes)
 * - signature.json   (signature over manifest.json; includes alg, keyId, signature_b64, optional PEM)
 *
 * IMPORTANT: We sign the exact manifest bytes we write to the zip. We do not
 * mutate the manifest after signing, so verification can re-hash the same bytes.
 */
export async function buildSignedBundle(subjectId: string, meta?: Record<string, any>) {
  // 1) Build the pack and normalize to Uint8Array
  const raw = (await buildProofPack(subjectId)) as Uint8Array | ArrayBuffer | ArrayBufferLike;
  const pack = ensureU8(raw);
  const packHash = sha256Hex(pack);

  // 2) Build a stable manifest (no alg here—alg is in signature.json)
  const signer = await getSigner();
  const keyId = await signer.keyId();

  const manifest: Manifest = {
    schema: "unlistin.proofpack.manifest@v1",
    subjectId,
    createdAt: new Date().toISOString(),
    signer: {
      backend: (process.env.SIGNING_BACKEND || "local-ed25519").trim(),
      keyId,
    },
    assets: {
      filename: "pack.zip",
      sha256: packHash,
      size: pack.byteLength,
    },
    meta,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  // 3) Sign the manifest bytes (sha256+sign inside the signer)
  const signed = await signer.signSha256(manifestBytes);

  // 4) Prepare signature.json (keeps signature metadata separate from manifest)
  const sigJson = JSON.stringify(
    {
      algorithm: signed.alg as "ed25519" | "rsa-pss-sha256",
      key_id: signed.keyId,
      signature_b64: Buffer.from(signed.signature).toString("base64"),
      public_key_pem: signed.publicKeyPem ?? undefined,
    },
    null,
    2
  );
  const sigBytes = new TextEncoder().encode(sigJson);

  // 5) Assemble final zip
  const zip = new JSZip();
  zip.file("pack.zip", pack);
  zip.file("manifest.json", manifestBytes);
  zip.file("signature.json", sigBytes);

  // Return a Uint8Array
  const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return out;
}

/**
 * Back-compat alias for callers using the older name.
 */
export async function buildSignedExport(subjectId: string, meta?: Record<string, any>) {
  return buildSignedBundle(subjectId, meta);
}
