// src/lib/proofs/merkle.ts
import { MerkleTree } from "merkletreejs";
import crypto from "crypto";
import { signAsync, getPublicKey } from "@noble/ed25519";

/** sha256 -> Buffer */
function sha256Buf(input: Buffer | string) {
  return crypto.createHash("sha256").update(input).digest();
}

/** sha256 -> hex */
function sha256Hex(input: Buffer | string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function isHex(str: string) {
  return /^[0-9a-fA-F]+$/.test(str);
}

/**
 * Build a Merkle root from a list of items that may be:
 * - already-hashed hex strings (64 hex chars), OR
 * - raw strings that should be hashed first.
 *
 * Returns the root hex and the underlying merkletree instance.
 */
export function buildMerkleRoot(items: string[]) {
  const leaves: Buffer[] = (items || [])
    .map((s) => (s ?? "").toString())
    .filter((s) => s.length > 0)
    .map((s) => {
      // If it *looks* like a 32-byte hex hash, treat as already-hashed.
      if (s.length === 64 && isHex(s)) return Buffer.from(s, "hex");
      // Otherwise, hash the raw string to create the leaf.
      return Buffer.from(sha256Hex(Buffer.from(s, "utf8")), "hex");
    });

  // Edge-case: no leaves -> hash of empty to remain deterministic.
  const tree =
    leaves.length > 0
      ? new MerkleTree(leaves, sha256Buf as any)
      : new MerkleTree([sha256Buf("")], sha256Buf as any);

  const rootHex = tree.getRoot().toString("hex");
  return { rootHex, tree };
}

/** Normalize PROOF_SIGNING_KEY to a 32-byte private key */
function getPrivateKeyBytes(): Uint8Array {
  const raw = process.env.PROOF_SIGNING_KEY;
  if (!raw) {
    // Deterministic dev key (DO NOT use in prod)
    const dev = sha256Hex("unlistin-dev-key");
    return new Uint8Array(Buffer.from(dev, "hex"));
  }

  // Accept hex, base64, or utf8 and derive 32 bytes as needed.
  try {
    if (isHex(raw) && raw.length >= 64) {
      return new Uint8Array(Buffer.from(raw.slice(0, 64), "hex"));
    }
    // crude base64 check; if it fails, we'll fall back to utf8
    if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
      const buf = Buffer.from(raw, "base64");
      return new Uint8Array(buf.subarray(0, 32));
    }
  } catch {
    // fall through to utf8
  }

  const utf = Buffer.from(raw, "utf8");
  const stretched = sha256Hex(utf); // 32 bytes via sha256
  return new Uint8Array(Buffer.from(stretched, "hex"));
}

/**
 * Sign a merkle root (hex) with Ed25519.
 * Returns the signature as hex.
 */
export async function signRoot(rootHex: string) {
  if (!rootHex || !isHex(rootHex)) throw new Error("Invalid root hex");
  const sk = getPrivateKeyBytes();
  const msg = Buffer.from(rootHex, "hex");
  const sig = await signAsync(msg, sk);
  return Buffer.from(sig).toString("hex");
}

/** Optional helper if you ever want to expose/verify the public key */
export async function getPublicKeyHex(): Promise<string> {
  const sk = getPrivateKeyBytes();
  const pk = await getPublicKey(sk);
  return Buffer.from(pk).toString("hex");
}
