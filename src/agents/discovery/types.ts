// src/agents/discovery/types.ts
export interface DiscoveryInput {
  subjectId: string;        // UUID
  orgId: string;            // UUID
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

export interface CandidateItem {
  controllerName: string;   // e.g., "Truecaller"
  source: string;           // e.g., "provider:truecaller"
  url?: string;
  dataType: "phone" | "email" | "profile" | "listing" | "address";
  confidence: number;       // 0..1
  evidence?: Record<string, any>;
}

export interface DiscoveryProvider {
  readonly id: string;
  discover(input: DiscoveryInput): Promise<CandidateItem[]>;
}
