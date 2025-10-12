// src/lib/orchestrator/types.ts
export type Stage =
  | "discovery"
  | "policy"
  | "request"
  | "dispatch"
  | "verification"
  | "completed"
  | "failed";

export interface DeletionState {
  taskId: string;
  subjectId: string;
  orgId?: string;
  phone?: string;
  email?: string;
  stage: Stage;
  discoveredItems: Array<{ controllerId?: string; source: string; url?: string; confidence: number }>;
  policies: Record<string, any>;
  requests: Array<{ actionId?: string; controllerId?: string; channel: "email"|"form"|"api"|"legal"; status: "pending"|"sent"|"verified"|"failed" }>;
  evidence: Array<any>;
  errors: Array<{ at: Stage; reason: string }>;
}
