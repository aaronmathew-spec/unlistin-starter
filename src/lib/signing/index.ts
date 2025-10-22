// src/lib/signing/index.ts
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

function nonEmptyEnv(name: string, required = true): string {
  const v = (process.env[name] || "").trim();
  if (required && !v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

/**
 * Wrap a Signer to prefer SIGNING_PUBLIC_KEY_PEM if provided.
 * This avoids extra KMS GetPublicKey calls during export/verify flows.
 */
function withPublicKeyOverride(inner: Signer): Signer {
  const override = (process.env.SIGNING_PUBLIC_KEY_PEM || "").trim();
  if (!override) return inner;

  return {
    async keyId() {
      return inner.keyId();
    },
    async publicKeyPem() {
      return override;
    },
    async signSha256(bytes: Uint8Array) {
      // signing still delegated to the inner signer
      const res = await inner.signSha256(bytes);
      // ensure we surface the override in the result for convenience
      return { ...res, publicKeyPem: override };
    },
  };
}

export async function getSigner(): Promise<Signer> {
  if (cached) return cached;

  const backend = (process.env.SIGNING_BACKEND || "local-ed25519").trim();

  if (backend === "aws-kms") {
    // Require region + key id
    const region = nonEmptyEnv("AWS_REGION", true);
    const keyId = nonEmptyEnv("AWS_KMS_KEY_ID", true);

    // Lazy import to keep client-only bundles slim
    const { kmsSigner } = await import("./kms/aws-kms");
    const signer = await kmsSigner({ region, keyId });
    cached = withPublicKeyOverride(signer);
    return cached;
  }

  // Default: local Ed25519 (dev)
  const keyId = nonEmptyEnv("SIGNING_KEY_ID", true);
  const privateKeyPem = nonEmptyEnv("SIGNING_PRIVATE_KEY_PEM", true);

  const { localEd25519Signer } = await import("./local/local-ed25519");
  const signer = await localEd25519Signer({ keyId, privateKeyPem });
  cached = withPublicKeyOverride(signer);
  return cached;
}
