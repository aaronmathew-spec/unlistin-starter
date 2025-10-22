import { KMSClient, GetPublicKeyCommand, SignCommand } from "@aws-sdk/client-kms";
import { Signer } from "../index";

function derToPem(der: Uint8Array, label: string): string {
  const b64 = Buffer.from(der).toString("base64").match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

export async function kmsSigner(opts: { region: string; keyId: string }): Promise<Signer> {
  const client = new KMSClient({ region: opts.region });
  let cachedPubPem: string | null = null;

  async function getPubPem(): Promise<string> {
    if (cachedPubPem) return cachedPubPem;
    const res = await client.send(new GetPublicKeyCommand({ KeyId: opts.keyId }));
    if (!res.PublicKey) throw new Error("KMS public key not returned");
    // KMS returns SubjectPublicKeyInfo DER
    cachedPubPem = derToPem(res.PublicKey as Uint8Array, "PUBLIC KEY");
    return cachedPubPem!;
  }

  return {
    async keyId() {
      return opts.keyId;
    },
    async publicKeyPem() {
      return await getPubPem();
    },
    async signSha256(bytes) {
      const res = await client.send(
        new SignCommand({
          KeyId: opts.keyId,
          Message: Buffer.from(bytes),
          MessageType: "DIGEST",
          // We standardize on RSA-PSS-SHA256 for prod
          SigningAlgorithm: "RSASSA_PSS_SHA_256",
        })
      );
      if (!res.Signature) throw new Error("KMS sign failed");
      return {
        keyId: opts.keyId,
        alg: "rsa-pss-sha256",
        signature: Buffer.from(res.Signature as Uint8Array),
        publicKeyPem: await getPubPem(),
      };
    },
  };
}
