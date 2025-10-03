import { createHash } from "crypto";

/** Generate a deterministic idempotency key from a JSON-able payload */
export function idemKey(payload: unknown): string {
  const s = JSON.stringify(payload ?? {});
  return createHash("sha256").update(s, "utf8").digest("hex");
}
