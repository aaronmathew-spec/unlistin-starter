// src/lib/proofs/export.ts
import JSZip from "jszip";
import { createHash } from "crypto";
import { getSigner } from "@/lib/signing";
import { buildProofPack } from "@/lib/proofs/pack"; // returns Uint8Array or ArrayBuffer

type Manifest = {
  schema: "unlistin.proofpack.manifest@v1";
  subjectId: string;
  createdAt: string; // ISO
  signer: {
    backend: string; // env SIGNING_BACKEND
    keyId: string;
    alg: "ed25519" | "rsa-pss-sha256";
  };
  assets: {
    filename: "pack.zip";
    sha256: string; // hex digest of pack.zip
    size: number;   // bytes
  };
  // room for future fields
  meta?: Record<string, any>;
};

function ensureU8(x: Uint8Array | ArrayBuffer): Uint8Array {
  return x instanceof Uint8Array ? x : new Uint8Array(x);
}

function sha256Hex(u8: Uint8Array): string {
  const h = createHash("sha256");
  h.update(u8);
  return h.digest("hex");
}

export async function buildSignedExport(subjectId: string, meta?: Record<string, any>) {
  // 1) Get your existing pack.zip (normalize to Uint8Array)
  const raw = (await buildProofPack(subjectId)) as Uint8Array | ArrayBuffer;
  const pack = ensureU8(raw);
  const packHash = sha256Hex(pack);

  // 2) Build manifest (deterministic fields only)
  const signer = await getSigner();
  const keyId = await signer.keyId();

  const manifest: Manifest = {
    schema: "unlistin.proofpack.manifest@v1",
    subjectId,
    createdAt: new Date().toISOString(),
    signer: {
      backend: (process.env.SIGNING_BACKEND || "local-ed25519").trim(),
      keyId,
      // set after signing when we know the algorithm used
      alg: "ed25519", // placeholder, updated below
    },
    assets: {
      filename: "pack.zip",
      sha256: packHash,
      size: pack.byteLength,
    },
    meta,
  };

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  // 3) Sign the manifest using your Signer API (hash+sign inside)
  const signed = await signer.signSha256(manifestBytes);
  const signature = ensureU8(signed.signature);

  // Update manifest signer alg accurately (ed25519 | rsa-pss-sha256)
  manifest.signer.alg = signed.alg;

  // 4) Create final ZIP bundle
  const zip = new JSZip();
  zip.file("pack.zip", pack);
  // Use the manifest with the correct alg; regenerate the bytes to reflect the alg
  const finalManifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  zip.file("manifest.json", finalManifestBytes);
  zip.file("signature.bin", signature);

  // Prefer env override if present; else ask signer (some KMS paths fetch public key)
  try {
    const pubPem = await signer.publicKeyPem();
    if (pubPem) {
      zip.file("public_key.pem", pubPem);
    }
  } catch {
    // optional; skip if signer doesn't provide
  }

  // Return a Uint8Array for the route to stream
  const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return out;
}
