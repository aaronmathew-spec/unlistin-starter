// src/components/AppNav.tsx
import Link from "next/link";
import { getSessionUser, isAdmin } from "@/lib/auth";

export default async function AppNav() {
  // Server component: resolve the current user once per request
  const user = await getSessionUser();
  const admin = await isAdmin();

  return (
    <nav className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold text-gray-900 hover:text-gray-700">
            UnlistIN
          </Link>

          {/* Primary nav */}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/actions" className="text-gray-600 hover:text-gray-900">
              Actions
            </Link>
            <Link href="/ops/overview" className="text-gray-600 hover:text-gray-900">
              Ops
            </Link>
            {admin && (
              <Link href="/admin" className="text-blue-700 hover:text-blue-800 font-medium">
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* Right side: auth state */}
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-gray-600 hidden sm:inline">
                {user.email ?? "Signed in"}
              </span>
              <Link
                href="/auth/signout"
                className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
              >
                Sign out
              </Link>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
