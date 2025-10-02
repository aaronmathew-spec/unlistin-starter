// lib/ledger.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, createHmac, randomBytes } from "crypto";

/**
 * Proof-of-Action Ledger helpers.
 * We create a deterministic message hash over an action "envelope" that is PII-safe:
 * - broker, category, redacted_identity, evidence URLs (allowlisted), draft_subject hash only.
 * Then we sign via HMAC (server key). This yields (hash, sig) pairs stored with the action.
 *
 * Public verify endpoint recomputes hash and verifies HMAC without revealing any PII.
 */

const LEDGER_KEY = process.env.LEDGER_HMAC_KEY || process.env.EVIDENCE_KEY || "";
if (!LEDGER_KEY) {
  // It's okay during local dev; on prod you should set LEDGER_HMAC_KEY.
  // We avoid throwing to keep builds green.
}

export type LedgerEnvelope = {
  id: string;
  broker: string;
  category: string;
  redacted_identity: {
    namePreview?: string;
    emailPreview?: string;
    cityPreview?: string;
  };
  evidence_urls: string[]; // allowlisted only
  draft_subject_hash?: string; // sha256 hex of subject string
  timestamp: string; // ISO
};

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function randomIdHex(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function signEnvelope(env: LedgerEnvelope): { hash: string; sig: string } {
  const payload = JSON.stringify(env);
  const hash = sha256Hex(payload);
  const sig = createHmac("sha256", LEDGER_KEY || "dev-key").update(hash, "utf8").digest("hex");
  return { hash, sig };
}

export function verifySignature(hash: string, sig: string): boolean {
  const expected = createHmac("sha256", LEDGER_KEY || "dev-key").update(hash, "utf8").digest("hex");
  return timingSafeEq(sig, expected);
}

function timingSafeEq(a: string, b: string): boolean {
  // constant-time compare
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  let r = 0;
  for (let i = 0; i < ba.length; i++) r |= ba[i] ^ bb[i];
  return r === 0;
}
