/* eslint-disable @typescript-eslint/no-explicit-any */
export type AuditEvent =
  | "removal.submit"
  | "removal.email.sent"
  | "mailroom.intake"
  | "agent.run.start"
  | "agent.run.end"
  | "agent.run.error";

export function audit(event: AuditEvent, meta?: Record<string, any>) {
  // Lightweight server log; extend to your logger if you have one
  console.log(`[AUDIT] ${event}`, meta ?? {});
}
