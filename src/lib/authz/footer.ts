// src/lib/authz/footer.ts
import { getAuthorization } from "@/src/lib/authz/store";

/**
 * Build a short, human-readable footer that proves we have signed authority.
 * Safe to append to plaintext email bodies.
 */
export async function authorizationFooter(authorizationId: string): Promise<string> {
  try {
    const got = await getAuthorization(authorizationId);
    if (!got.record) return "";

    const hash = (got.record.manifest_hash || "").slice(0, 12);
    const when = new Date(got.record.signed_at).toISOString();

    // Keep this minimal & compliance-friendly.
    return [
      "",
      "--",
      "Authorization:",
      `  ID: ${authorizationId}`,
      `  Signed: ${when}`,
      `  Hash: ${hash}`,
    ].join("\n");
  } catch {
    return "";
  }
}
