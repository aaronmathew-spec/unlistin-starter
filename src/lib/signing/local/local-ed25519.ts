import { Signer } from "../index";
import * as ed from "@noble/ed25519";

export function pemToRawEd25519PrivateKey(pem: string): Uint8Array {
  // Expecting a PKCS#8 PEM for Ed25519
  const b64 = pem.replace(/-----(BEGIN|END)[\s\S]+?-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

export function rawToPemPublicKeyEd25519(rawPub: Uint8Array): string {
  // SubjectPublicKeyInfo for Ed25519 (RFC 8410)
  const header = Buffer.from(
    "302a300506032b6570032100", // ASN.1: SEQUENCE( OID Ed25519, BIT STRING 32 bytes )
    "hex"
  );
  const body = Buffer.concat([header, Buffer.from(rawPub)]);
  const base64 = body.toString("base64").match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----\n`;
}

export function localEd25519Signer(opts: { keyId: string; privateKeyPem: string }): Signer {
  const keyId = opts.keyId;

  // Derive pubkey from private key bytes
  const rawPriv = pemToRawEd25519PrivateKey(opts.privateKeyPem);
  const rawSeed = rawPriv.slice(-32); // last 32 bytes are seed for Ed25519 in PKCS#8
  const pubPromise = (async () => {
    const pub = await ed.getPublicKey(rawSeed);
    return rawToPemPublicKeyEd25519(pub);
  })();

  return {
    async keyId() {
      return keyId;
    },
    async publicKeyPem() {
      return await pubPromise;
    },
    async signSha256(bytes) {
      const raw = Buffer.from(bytes);
      const sig = await ed.sign(raw, rawSeed);
      return { keyId, alg: "ed25519", signature: Buffer.from(sig), publicKeyPem: await pubPromise };
    },
  };
}
