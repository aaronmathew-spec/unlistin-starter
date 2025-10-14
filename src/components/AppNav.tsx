// src/components/AppNav.tsx
import Link from "next/link";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function AppNav() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);

  return (
    <nav className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold">UnlistIN</Link>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/subjects" className="text-sm text-gray-600 hover:text-gray-900">Subjects</Link>
          {admin && (
            <>
              <Link href="/ops/overview" className="text-sm text-blue-700">Ops</Link>
              <Link href="/ops/webforms" className="text-sm text-blue-700">Webforms</Link>
              <Link href="/ops/controllers" className="text-sm text-blue-700">Controllers</Link>
            </>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {user?.email ?? "Signed out"}
        </div>
      </div>
    </nav>
  );
}
