// src/lib/proofs/merkle.ts
import { MerkleTree } from "merkletreejs";
import crypto from "crypto";
import { signAsync } from "@noble/ed25519";

function sha256Buf(input: Buffer | string) {
  return crypto.createHash("sha256").update(input).digest();
}

export function buildMerkleRoot(hashesHex: string[]) {
  const leaves = hashesHex.map((h) => Buffer.from(h, "hex"));
  const tree = new MerkleTree(leaves, sha256Buf as any);
  return { rootHex: tree.getRoot().toString("hex"), tree };
}

export async function signRoot(rootHex: string) {
  const privHex = process.env.PROOF_SIGNING_KEY;
  if (!privHex) throw new Error("Missing PROOF_SIGNING_KEY");
  const sig = await signAsync(Buffer.from(rootHex, "hex"), Buffer.from(privHex, "hex"));
  return Buffer.from(sig).toString("hex");
}
