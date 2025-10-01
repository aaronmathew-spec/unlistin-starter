// Shared types for AI features used by app/ai/page.tsx and API routes.

export type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

export type RequestHit = {
  kind: "request";
  id: number;
  title: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
};

export type FileHit = {
  kind: "file";
  id: number;
  request_id: number;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type SemanticHit = {
  kind: "request" | "file";
  ref_id: number;
  content: string;
  score: number;
};
