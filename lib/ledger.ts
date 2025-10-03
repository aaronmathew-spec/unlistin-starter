/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, createHmac, randomBytes, timingSafeEqual as tse } from "crypto";

/**
 * Proof-of-Action Ledger helpers.
 * We create a deterministic message hash over an action "envelope" that is PII-safe:
 * - broker, category, redacted_identity, evidence URLs (allowlisted), draft_subject hash only.
 * Then we sign via HMAC (server key). This yields (hash, sig) pairs stored with the action.
 *
 * Public verify endpoint recomputes hash and verifies HMAC without revealing any PII.
 */

const LEDGER_KEY = process.env.LEDGER_HMAC_KEY || process.env.EVIDENCE_KEY || "";
// OK if empty during local dev; on prod set LEDGER_HMAC_KEY.

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
  return timingSafeEq(expected, sig);
}

/** Constant-time hex equality using Node's crypto.timingSafeEqual */
function timingSafeEq(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  try {
    return tse(a, b);
  } catch {
    return false;
  }
}
