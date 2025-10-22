import { createHash } from "crypto";

type SignResult = {
  keyId: string;
  alg: "ed25519" | "rsa-pss-sha256";
  signature: Buffer; // raw signature bytes
  publicKeyPem?: string; // optional cache/fill for verification/export
};

export interface Signer {
  keyId(): Promise<string>;
  publicKeyPem(): Promise<string>;
  signSha256(bytes: Uint8Array): Promise<SignResult>;
}

// Small helper: SHA-256 bytes
export function sha256(data: Uint8Array | Buffer | string): Buffer {
  const h = createHash("sha256");
  h.update(typeof data === "string" ? Buffer.from(data) : Buffer.from(data));
  return h.digest();
}

let cached: Signer | null = null;

export async function getSigner(): Promise<Signer> {
  if (cached) return cached;

  const backend = (process.env.SIGNING_BACKEND || "local-ed25519").trim();

  if (backend === "aws-kms") {
    const { kmsSigner } = await import("./kms/aws-kms");
    cached = await kmsSigner({
      region: process.env.AWS_REGION!,
      keyId: process.env.AWS_KMS_KEY_ID!,
    });
    return cached;
  }

  const { localEd25519Signer } = await import("./local/local-ed25519");
  cached = await localEd25519Signer({
    keyId: process.env.SIGNING_KEY_ID!,
    privateKeyPem: process.env.SIGNING_PRIVATE_KEY_PEM!,
  });
  return cached;
}
