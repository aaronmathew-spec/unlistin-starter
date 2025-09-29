// lib/mcp/registry.ts
// Allowlist of tools the server will accept.
// In Phase 2 we validate; execution is deferred to the task runner (Phase 3+).

export const MCP_TOOLS = {
  http_get: { key: "http_get", name: "HTTP GET (safe)", enabled: true },
  send_email_draft: { key: "send_email_draft", name: "Email Draft (no send)", enabled: true },
  coverage_note: { key: "coverage_note", name: "Coverage Note Draft", enabled: true },
} as const;

export type ToolKey = keyof typeof MCP_TOOLS;

export function isAllowedTool(key: string): key is ToolKey {
  return (key as ToolKey) in MCP_TOOLS && MCP_TOOLS[key as ToolKey].enabled;
}
