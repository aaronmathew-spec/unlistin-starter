// src/lib/compliance/dsr.ts
// Typed DSR matrix + region→law resolution (additive, non-breaking).

export type LawKey = "DPDP_IN" | "GDPR_EU" | "CCPA_US_CA";

export type RequestType =
  | "erasure"
  | "access"
  | "correction"
  | "restriction"
  | "portability"
  | "objection";

export type EvidenceRequirement =
  | "identity-basic"     // name + email or phone
  | "identity-strong"    // government ID or notarized attestation
  | "account-control"    // signed-in request or verified email link
  | "relationship-proof" // agent/guardian authority, PoA

export type PolicyEntry = {
  law: LawKey;
  jurisdiction: string;   // Human-readable (e.g., "European Union (GDPR)")
  defaultRequest: RequestType;
  allowedRequests: RequestType[];
  slaBusinessDays: number; // simple target for now; refine per controller as needed
  evidence: EvidenceRequirement[];
};

export const DSR_MATRIX: Record<LawKey, PolicyEntry> = {
  DPDP_IN: {
    law: "DPDP_IN",
    jurisdiction: "India (DPDP)",
    defaultRequest: "erasure",
    allowedRequests: ["erasure", "access", "correction", "objection"],
    slaBusinessDays: 7, // conservative starter
    evidence: ["identity-basic", "account-control"],
  },
  GDPR_EU: {
    law: "GDPR_EU",
    jurisdiction: "European Union (GDPR)",
    defaultRequest: "erasure",
    allowedRequests: [
      "erasure",
      "access",
      "correction",
      "restriction",
      "portability",
      "objection",
    ],
    slaBusinessDays: 30, // typical one-month window
    evidence: ["identity-basic", "account-control"],
  },
  CCPA_US_CA: {
    law: "CCPA_US_CA",
    jurisdiction: "United States — California (CCPA/CPRA)",
    defaultRequest: "erasure",
    allowedRequests: ["erasure", "access", "correction", "opt-out" as any], // "opt-out" often treated as objection
    slaBusinessDays: 45, // common CCPA/CPRA timeline
    evidence: ["identity-basic", "account-control"],
  },
};

/**
 * Normalize a user/tenant region code into a LawKey.
 * Accepts broad inputs like "IN", "EU", "US-CA", "india", "europe", etc.
 * Falls back to GDPR_EU as a global baseline if unclear.
 */
export function resolveLawKeyFromRegion(input: string | undefined | null): LawKey {
  const v = (input || "").trim().toUpperCase();

  // India / DPDP
  if (v === "IN" || v === "INDIA" || v === "DPDP_IN" || v === "DPDP") return "DPDP_IN";

  // European Union / GDPR
  if (
    v === "EU" ||
    v === "EUROPE" ||
    v === "EEA" ||
    v === "GDPR" ||
    v === "GDPR_EU"
  ) {
    return "GDPR_EU";
  }

  // California / CCPA
  if (v === "US-CA" || v === "CA-US" || v === "CALIFORNIA" || v === "CCPA" || v === "CCPA_US_CA") {
    return "CCPA_US_CA";
  }

  // Minimal ISO-ish hints
  if (v.startsWith("US-") && v.includes("CA")) return "CCPA_US_CA";

  // Default global baseline (GDPR is widely-accepted baseline)
  return "GDPR_EU";
}

/** Lookup the full policy entry from a region-ish string. */
export function resolvePolicyByRegion(input: string | undefined | null): PolicyEntry {
  const key = resolveLawKeyFromRegion(input);
  return DSR_MATRIX[key];
}
