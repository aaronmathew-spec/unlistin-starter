// src/lib/signing/kms.ts
import { KMSClient, SignCommand, GetPublicKeyCommand } from "@aws-sdk/client-kms";
import type { SignBase } from "./types";

function getEnv(k: string, req = true) {
  const v = (process.env[k] || "").trim();
  if (req && !v) throw new Error(`${k} is required for aws-kms signing`);
  return v;
}

export function kmsSigner(): SignBase {
  const region = getEnv("AWS_REGION");
  const keyId = getEnv("AWS_KMS_KEY_ID");

  const client = new KMSClient({ region });

  return {
    keyId,
    algo: "rsa-pss-sha256",
    async sign(bytes: Uint8Array) {
      const cmd = new SignCommand({
        KeyId: keyId,
        Message: bytes,
        MessageType: "RAW",
        SigningAlgorithm: "RSASSA_PSS_SHA_256",
      });
      const res = await client.send(cmd);
      if (!res.Signature) throw new Error("KMS returned no signature");
      return new Uint8Array(res.Signature as Uint8Array);
    },
    async publicKeyPEM() {
      // If you set SIGNING_PUBLIC_KEY_PEM in env, prefer that to avoid an API call
      const injected = (process.env.SIGNING_PUBLIC_KEY_PEM || "").trim();
      if (injected) return injected;

      const pub = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
      if (!pub.PublicKey) return undefined;
      // Convert DER to PEM
      const der = Buffer.from(pub.PublicKey as Uint8Array);
      const b64 = der.toString("base64").replace(/(.{64})/g, "$1\n");
      return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
    },
  };
}
