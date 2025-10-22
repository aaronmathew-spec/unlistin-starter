// src/lib/proofs/export.ts
import JSZip from "jszip";
import { createHash } from "node:crypto";
import { getSigner } from "@/lib/signing";
import { buildProofPack } from "@/lib/proofs/pack"; // <- you already have this
// buildProofPack(subjectId) -> Uint8Array of the current pack.zip

type Manifest = {
  schema: "unlistin.proofpack.manifest@v1";
  subjectId: string;
  createdAt: string; // ISO
  signer: {
    backend: string;     // env SIGNING_BACKEND
    keyId: string;
    algo: "ed25519" | "rsa-pss-sha256";
  };
  assets: {
    filename: string;    // always "pack.zip"
    sha256: string;      // hex digest of pack.zip
    size: number;        // bytes
  };
  // room for future fields
  meta?: Record<string, any>;
};

function sha256Hex(u8: Uint8Array): string {
  const h = createHash("sha256");
  h.update(u8);
  return h.digest("hex");
}

export async function buildSignedExport(subjectId: string, meta?: Record<string, any>) {
  // 1) Get your existing pack.zip
  const pack = await buildProofPack(subjectId); // Uint8Array
  const packHash = sha256Hex(pack);

  // 2) Build a deterministic manifest
  const signer = getSigner();
  const manifest: Manifest = {
    schema: "unlistin.proofpack.manifest@v1",
    subjectId,
    createdAt: new Date().toISOString(),
    signer: {
      backend: (process.env.SIGNING_BACKEND || "local-ed25519").trim(),
      keyId: signer.keyId,
      algo: signer.algo,
    },
    assets: {
      filename: "pack.zip",
      sha256: packHash,
      size: pack.byteLength,
    },
    meta,
  };

  const manifestJson = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  // 3) Sign manifest bytes
  const sig = await signer.sign(manifestJson);
  const pubPem = signer.publicKeyPEM ? await signer.publicKeyPEM() : undefined;

  // 4) Wrap into one ZIP
  const out = new JSZip();
  out.file("pack.zip", pack);
  out.file("manifest.json", manifestJson);
  out.file("signature.bin", sig);
  if (pubPem) out.file("public_key.pem", pubPem);

  const zipU8 = await out.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return zipU8;
}
