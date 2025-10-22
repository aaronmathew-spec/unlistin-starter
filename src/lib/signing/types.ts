// src/lib/signing/types.ts
export type SignAlgo = "ed25519" | "rsa-pss-sha256";

export interface SignBase {
  keyId: string;
  algo: SignAlgo;
  /** Returns raw signature bytes */
  sign(bytes: Uint8Array): Promise<Uint8Array>;
  /** Optional public PEM for offline verify */
  publicKeyPEM?(): Promise<string | undefined>;
}
