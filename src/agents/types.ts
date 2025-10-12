import { z } from "zod";

// Discovered Item Schema
export const DiscoveredItemSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  sourceType: z.enum(["caller_id", "directory", "employment", "e_commerce", "social_media", "unknown"]),
  url: z.string().url(),
  dataType: z.enum(["phone", "email", "address", "profile", "listing", "review"]),
  confidence: z.number().min(0).max(1),
  evidence: z.object({
    screenshot: z.string().optional(),
    html: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  discoveredAt: z.date(),
});

// Policy Schema
export const PolicySchema = z.object({
  controllerId: z.string().uuid(),
  source: z.string(),
  channel: z.enum(["email", "webform", "api", "legal_letter", "phone"]),
  contact: z.object({
    email: z.string().email().optional(),
    formUrl: z.string().url().optional(),
    apiEndpoint: z.string().url().optional(),
    phone: z.string().optional(),
  }),
  template: z.string(),
  identityProof: z.enum(["none", "email_verify", "phone_verify", "aadhaar_masked", "digilocker"]),
  slaDays: z.number().int().positive(),
  escalationPath: z.array(z.string()),
  generatedAt: z.date(),
});

// Request Schema
export const RequestSchema = z.object({
  id: z.string().uuid(),
  subjectId: z.string().uuid(),
  orgId: z.string().uuid(),
  controllerId: z.string().uuid(),
  discoveredItemId: z.string().uuid(),
  channel: z.enum(["email", "webform", "api", "legal_letter"]),
  payload: z.record(z.any()),
  status: z.enum(["pending", "sent", "delivered", "bounced", "verified", "failed"]),
  slaDeadline: z.date(),
  retryCount: z.number().int().min(0).default(0),
  createdAt: z.date(),
  sentAt: z.date().optional(),
});

// Evidence Schema
export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  type: z.enum(["screenshot", "dom_tree", "email_receipt", "search_index", "api_response"]),
  contentHash: z.string(),
  contentUri: z.string().url(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
});

// Agent State Schema
export const AgentStateSchema = z.object({
  taskId: z.string().uuid(),
  subjectId: z.string().uuid(),
  orgId: z.string().uuid(),
  stage: z.enum([
    "initializing",
    "discovery",
    "policy_synthesis",
    "request_generation",
    "dispatch",
    "verification",
    "completed",
    "failed",
  ]),
  subject: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    alternateIdentities: z.array(z.object({
      type: z.string(),
      value: z.string(),
    })).optional(),
  }),
  discoveredItems: z.array(DiscoveredItemSchema),
  policies: z.array(PolicySchema),
  requests: z.array(RequestSchema),
  evidence: z.array(EvidenceSchema),
  errors: z.array(z.object({
    agent: z.string(),
    error: z.string(),
    timestamp: z.date(),
    recoverable: z.boolean(),
  })),
  metadata: z.object({
    startedAt: z.date(),
    lastUpdatedAt: z.date(),
    estimatedCompletionAt: z.date().optional(),
    progress: z.object({
      discoveryPercent: z.number().min(0).max(100),
      policyPercent: z.number().min(0).max(100),
      requestPercent: z.number().min(0).max(100),
      verificationPercent: z.number().min(0).max(100),
    }),
  }),
});

export type AgentState = z.infer<typeof AgentStateSchema>;
export type DiscoveredItem = z.infer<typeof DiscoveredItemSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type Request = z.infer<typeof RequestSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;

export type AgentResult = {
  success: boolean;
  updatedState: Partial<AgentState>;
  nextAgent?: string;
  error?: string;
};

export const DISCOVERY_TARGETS = {
  MIN_SOURCES: 5,
  TARGET_SOURCES: 10,
  MAX_SOURCES: 50,
} as const;
