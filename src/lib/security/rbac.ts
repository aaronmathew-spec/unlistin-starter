/* src/lib/security/rbac.ts */
import "server-only";
import type { NextRequest } from "next/server";

export type AppRole = "admin" | "ops" | "analyst" | "user";

/**
 * Minimal role resolver:
 * - prefers X-App-Role header for ops tooling (behind SECURE_CRON_SECRET)
 * - otherwise, derives from env flags (fallback)
 * You can wire this to Supabase auth/JWT later without changing call sites.
 */
export function resolveRole(req?: NextRequest): AppRole {
  const hdr = req?.headers?.get("x-app-role")?.toLowerCase().trim();
  if (hdr === "admin" || hdr === "ops" || hdr === "analyst" || hdr === "user") return hdr;

  // env-based fallback for ops consoles
  if (process.env.FLAG_WEBFORM_ADMIN === "1") return "admin";
  if (process.env.FLAG_DLQ_RETRY === "1") return "ops";
  return "user";
}

export function ensureOpsOrAdmin(req?: NextRequest) {
  const role = resolveRole(req);
  if (role !== "admin" && role !== "ops") {
    const err = new Error("forbidden");
    (err as any).status = 403;
    throw err;
  }
  return role;
}
