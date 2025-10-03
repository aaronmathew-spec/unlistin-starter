// lib/auth/roles.ts
export type UserRole = "admin" | "member";

export function isAdmin(role?: string | null | undefined): boolean {
  const r = (role ?? "").toLowerCase();
  return r === "admin" || r === "owner" || r === "superadmin";
}

export function requireRole(role: string | null | undefined, need: UserRole): void {
  if (need === "admin" && !isAdmin(role)) {
    const e = new Error("Forbidden");
    (e as any).statusCode = 403;
    throw e;
  }
}
