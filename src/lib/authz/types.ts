// src/lib/authz/types.ts
export type ISODateString = string; // ISO8601

export type SubjectProfile = {
  subjectId?: string | null;      // your canonical subject ID if any
  fullName: string;
  email?: string | null;
  phone?: string | null;
  region?: string | null;         // e.g. "IN", "EU"
};

export type AuthorizationArtifact = {
  filename: string;               // e.g. "loa.pdf", "id-front.jpg"
  mime: string;                   // e.g. "application/pdf", "image/jpeg"
  base64: string;                 // raw file data, base64-encoded
};

export type AuthorizationInput = {
  subject: SubjectProfile;
  consentText: string;            // LoA text signed/acknowledged by data principal
  signerName: string;             // who signed
  signedAt: ISODateString;        // ISO timestamp
  artifacts?: AuthorizationArtifact[] | null;
};

export type AuthorizationRecord = {
  id: string;                     // UUID
  subject_id: string | null;
  subject_full_name: string;
  subject_email: string | null;
  subject_phone: string | null;
  region: string | null;
  signer_name: string;
  signed_at: string;              // ISO
  consent_text: string;
  manifest_hash: string;          // sha256(content-json)
  created_at: string;             // ISO
};

export type AuthorizationFileRecord = {
  id: string;                     // UUID
  authorization_id: string;       // FK
  path: string;                   // storage path (bucket: "authz")
  mime: string;
  bytes: number;
  created_at: string;             // ISO
};

export type AuthorizationManifest = {
  version: "authz.v1";
  authorizationId: string;        // DB id
  subject: Required<Pick<SubjectProfile, "fullName">> & SubjectProfile;
  consentText: string;
  signerName: string;
  signedAt: ISODateString;
  region: string | null;
  evidenceFiles: Array<{ path: string; mime: string; bytes: number }>;
  contentHash: string;            // sha256 of the canonical content (no signature)
  signature: {
    alg: "HMAC-SHA256";
    kid: "SIGNING_BACKEND";
    value: string;                // base64url signature value
  };
};
