// lib/crypto/signer.ts
/**
 * Unified signing facade for proof ledger & artifacts.
 * Backends:
 *  - "local-ed25519" (default): uses SIGNING_PRIVATE_KEY_PEM (PKCS#8) to sign bytes
 *  - "aws-kms" (optional): uses AWS KMS asymmetric key (RSA_PSS_2048_SHA256)
 *
 * Build-safe: we DO NOT import @aws-sdk/client-kms at build time.
 * If BACKEND=aws-kms at runtime but the package isn't installed, we throw a clear error then.
 */

import crypto from "node:crypto";

export type SignResult = {
  algorithm: "ed25519" | "rsa-pss-sha256";
  keyId: string;
  signatureBase64: string;
};

export type Signer = {
  sign(bytes: Uint8Array): Promise<SignResult>;
  algorithm(): SignResult["algorithm"];
  keyId(): string;
};

// ---------- environment ----------
const BACKEND = (process.env.SIGNING_BACKEND || "local-ed25519").toLowerCase();
// Local ED25519 expects PKCS#8 PEM
const LOCAL_PEM = process.env.SIGNING_PRIVATE_KEY_PEM || "";
const LOCAL_KEY_ID = process.env.SIGNING_KEY_ID || "local-ed25519-key";
// AWS KMS (optional)
const AWS_REGION = process.env.AWS_REGION || "";
const AWS_KMS_KEY_ID = process.env.AWS_KMS_KEY_ID || "";

// ---------- helpers ----------
/** Indirect dynamic import so bundlers don't require the module at build time. */
async function dynamicImport(moduleName: string): Promise<any> {
  // eslint-disable-next-line no-new-func
  const importer = new Function("m", "return import(m);");
  return importer(moduleName);
}

// ---------- local ed25519 ----------
class LocalEd25519Signer implements Signer {
  constructor(private keyPem: string, private id: string) {
    if (!keyPem.trim()) throw new Error("SIGNING_PRIVATE_KEY_PEM missing");
  }
  algorithm(): SignResult["algorithm"] { return "ed25519"; }
  keyId(): string { return this.id; }

  async sign(bytes: Uint8Array): Promise<SignResult> {
    const sig = crypto.sign(null, Buffer.from(bytes), this.keyPem);
    return {
      algorithm: "ed25519",
      keyId: this.id,
      signatureBase64: sig.toString("base64"),
    };
  }
}

// ---------- AWS KMS RSA-PSS 2048 ----------
class AwsKmsRsaPssSigner implements Signer {
  constructor(private kmsKeyId: string, private region: string) {
    if (!kmsKeyId || !region) {
      throw new Error("AWS_KMS_KEY_ID / AWS_REGION missing for aws-kms backend");
    }
  }
  algorithm(): SignResult["algorithm"] { return "rsa-pss-sha256"; }
  keyId(): string { return this.kmsKeyId; }

  async sign(bytes: Uint8Array): Promise<SignResult> {
    // Lazily load the AWS SDK only at runtime
    let KMS: any, SignCommand: any;
    try {
      const mod = await dynamicImport("@aws-sdk/client-kms");
      KMS = mod.KMS;
      SignCommand = mod.SignCommand;
    } catch {
      throw new Error(
        "SIGNING_BACKEND=aws-kms but @aws-sdk/client-kms is not installed. Run `npm i @aws-sdk/client-kms`."
      );
    }

    const kms = new KMS({ region: this.region });
    const digest = crypto.createHash("sha256").update(Buffer.from(bytes)).digest();

    const out = await kms.send(
      new SignCommand({
        KeyId: this.kmsKeyId,
        Message: digest,
        MessageType: "DIGEST",
        SigningAlgorithm: "RSASSA_PSS_SHA_256",
      })
    );

    const sig = out.Signature ?? new Uint8Array(0);
    return {
      algorithm: "rsa-pss-sha256",
      keyId: this.kmsKeyId,
      signatureBase64: Buffer.from(sig).toString("base64"),
    };
  }
}

// ---------- factory ----------
let _signer: Signer | null = null;

export function getSigner(): Signer {
  if (_signer) return _signer;

  switch (BACKEND) {
    case "aws-kms":
      _signer = new AwsKmsRsaPssSigner(AWS_KMS_KEY_ID, AWS_REGION);
      return _signer;
    case "local-ed25519":
    default:
      _signer = new LocalEd25519Signer(LOCAL_PEM, LOCAL_KEY_ID);
      return _signer;
  }
}
