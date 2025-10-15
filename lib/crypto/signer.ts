// lib/crypto/signer.ts
/**
 * Unified signing facade for proof ledger & artifacts.
 * Backends:
 *  - "local-ed25519" (default): uses SIGNING_PRIVATE_KEY_PEM (PKCS#8) to sign bytes
 *  - "aws-kms" (optional): uses AWS KMS asymmetric key (RSA_PSS_2048_SHA256) via env
 *
 * This module is lazy/KMS-optional: if you don't configure aws, it never imports the SDK.
 */

import crypto from "node:crypto";

export type SignResult = {
  algorithm: "ed25519" | "rsa-pss-sha256";
  keyId: string;        // your logical key name or KMS key id/arn
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
const AWS_REGION = process.env.AWS_REGION;
const AWS_KMS_KEY_ID = process.env.AWS_KMS_KEY_ID;

// ---------- local ed25519 ----------
class LocalEd25519Signer implements Signer {
  private keyPem: string;
  private id: string;

  constructor(pem: string, id: string) {
    if (!pem.trim()) throw new Error("SIGNING_PRIVATE_KEY_PEM missing");
    this.keyPem = pem.trim();
    this.id = id;
  }

  algorithm(): SignResult["algorithm"] { return "ed25519"; }
  keyId(): string { return this.id; }

  async sign(bytes: Uint8Array): Promise<SignResult> {
    // Node supports ed25519 via crypto.sign with PEM pkcs8
    const sig = crypto.sign(null, Buffer.from(bytes), this.keyPem);
    return {
      algorithm: "ed25519",
      keyId: this.id,
      signatureBase64: sig.toString("base64"),
    };
    // Verification example (elsewhere): crypto.verify(null, data, publicKeyPem, signature)
  }
}

// ---------- AWS KMS RSA-PSS 2048 ----------
class AwsKmsRsaPssSigner implements Signer {
  private id: string;
  private region: string;

  constructor(kmsKeyId: string, region: string) {
    if (!kmsKeyId || !region) throw new Error("AWS_KMS_KEY_ID / AWS_REGION missing");
    this.id = kmsKeyId;
    this.region = region;
  }

  algorithm(): SignResult["algorithm"] { return "rsa-pss-sha256"; }
  keyId(): string { return this.id; }

  async sign(bytes: Uint8Array): Promise<SignResult> {
    // Lazy import to avoid bundling SDK if unused
    const { KMS, SignCommand } = await import("@aws-sdk/client-kms");
    const kms = new KMS({ region: this.region });

    const digest = crypto.createHash("sha256").update(Buffer.from(bytes)).digest();
    const out = await kms.send(new SignCommand({
      KeyId: this.id,
      Message: digest,
      MessageType: "DIGEST",
      SigningAlgorithm: "RSASSA_PSS_SHA_256",
    }));

    const sig = out.Signature ?? new Uint8Array(0);
    return {
      algorithm: "rsa-pss-sha256",
      keyId: this.id,
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
      _signer = new AwsKmsRsaPssSigner(AWS_KMS_KEY_ID || "", AWS_REGION || "");
      return _signer;
    case "local-ed25519":
    default:
      _signer = new LocalEd25519Signer(LOCAL_PEM, LOCAL_KEY_ID);
      return _signer;
  }
}
