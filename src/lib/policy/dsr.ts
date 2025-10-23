// src/lib/policy/dsr.ts
// Canonical runtime matrix for Data Subject Requests by jurisdiction.
// Add/extend as you go; this is intentionally explicit & typed.

export type LawKey = "DPDP_IN" | "GDPR_EU" | "CCPA_US" | "LGPD_BR" | "PDPA_SG" | "APPI_JP";

export type RequestType =
  | "erasure"
  | "access"
  | "rectification"
  | "restrict_processing"
  | "objection"
  | "do_not_sell"        // CCPA/CPRA
  | "do_not_share"       // CCPA/CPRA
  | "data_portability";

export type EvidenceKind =
  | "id_government"
  | "id_selfie_match"
  | "authority_letter"
  | "purchase_receipt"
  | "email_control"
  | "phone_otp";

export type Channel = "email" | "webform" | "portal_api";

export type PolicyEntry = {
  law: LawKey;
  jurisdiction: string;          // human label
  requestTypes: RequestType[];
  defaultSLA_days: number;       // verification SLA to re-check
  escalation_after_days: number; // open grievance / escalate
  channelsPreferred: Channel[];  // preferred order
  requiredEvidence: EvidenceKind[];
  legalCitations: string[];      // human-readable refs
  languageHints?: string[];      // acceptable langs for the controller
};

export const DSR_MATRIX: Record<LawKey, PolicyEntry> = {
  DPDP_IN: {
    law: "DPDP_IN",
    jurisdiction: "India (DPDP 2023)",
    requestTypes: ["erasure", "access", "rectification", "restrict_processing", "data_portability"],
    defaultSLA_days: 7,
    escalation_after_days: 10,
    channelsPreferred: ["webform", "email"],
    requiredEvidence: ["id_government", "email_control"],
    legalCitations: [
      "Digital Personal Data Protection Act, 2023",
      "Data Principal rights — Sections 11–12",
    ],
    languageHints: ["en", "hi"],
  },
  GDPR_EU: {
    law: "GDPR_EU",
    jurisdiction: "EU/EEA (GDPR)",
    requestTypes: ["erasure", "access", "rectification", "restrict_processing", "objection", "data_portability"],
    defaultSLA_days: 30,
    escalation_after_days: 35,
    channelsPreferred: ["webform", "email", "portal_api"],
    requiredEvidence: ["email_control"],
    legalCitations: [
      "GDPR Art. 12–23",
      "Right to erasure — Art. 17",
    ],
    languageHints: ["en", "de", "fr", "es", "it", "nl"],
  },
  CCPA_US: {
    law: "CCPA_US",
    jurisdiction: "United States (CCPA/CPRA)",
    requestTypes: ["erasure", "access", "do_not_sell", "do_not_share", "data_portability"],
    defaultSLA_days: 45,
    escalation_after_days: 60,
    channelsPreferred: ["webform", "portal_api", "email"],
    requiredEvidence: ["email_control", "phone_otp"],
    legalCitations: [
      "Cal. Civ. Code § 1798.105 (Deletion)",
      "California Privacy Rights Act updates",
    ],
    languageHints: ["en", "es"],
  },
  LGPD_BR: {
    law: "LGPD_BR",
    jurisdiction: "Brazil (LGPD)",
    requestTypes: ["erasure", "access", "rectification", "data_portability", "objection"],
    defaultSLA_days: 15,
    escalation_after_days: 20,
    channelsPreferred: ["webform", "email"],
    requiredEvidence: ["email_control"],
    legalCitations: ["Lei Geral de Proteção de Dados Pessoais, Arts. 18–19"],
    languageHints: ["pt"],
  },
  PDPA_SG: {
    law: "PDPA_SG",
    jurisdiction: "Singapore (PDPA)",
    requestTypes: ["erasure", "access", "rectification", "data_portability"],
    defaultSLA_days: 30,
    escalation_after_days: 35,
    channelsPreferred: ["webform", "email"],
    requiredEvidence: ["email_control"],
    legalCitations: ["Personal Data Protection Act 2012, Parts V–VI"],
    languageHints: ["en", "zh"],
  },
  APPI_JP: {
    law: "APPI_JP",
    jurisdiction: "Japan (APPI)",
    requestTypes: ["erasure", "access", "rectification", "data_portability"],
    defaultSLA_days: 30,
    escalation_after_days: 35,
    channelsPreferred: ["webform", "email"],
    requiredEvidence: ["email_control"],
    legalCitations: ["Act on the Protection of Personal Information"],
    languageHints: ["ja", "en"],
  },
};

// Helper: pick the policy by ISO region or explicit key.
// You can evolve this to map controller.country to a law key.
export function resolvePolicyByRegion(region: string | LawKey): PolicyEntry | null {
  if (region in DSR_MATRIX) return DSR_MATRIX[region as LawKey];
  const r = String(region).toLowerCase();
  if (["in", "india"].includes(r)) return DSR_MATRIX.DPDP_IN;
  if (["eu", "eea", "eur"].includes(r)) return DSR_MATRIX.GDPR_EU;
  if (["us", "usa"].includes(r)) return DSR_MATRIX.CCPA_US;
  if (["br", "brazil"].includes(r)) return DSR_MATRIX.LGPD_BR;
  if (["sg", "singapore"].includes(r)) return DSR_MATRIX.PDPA_SG;
  if (["jp", "japan"].includes(r)) return DSR_MATRIX.APPI_JP;
  return null;
}
