// app/(app)/layout.tsx
import "../globals.css";
import "../design-system.css";
import Link from "next/link";

export const metadata = {
  title: "Unlistin",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
        {/* Royal gradient backdrop */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_-10%,rgba(139,92,246,.09),rgba(255,255,255,0))]" />
          <div
            className="absolute -top-44 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full blur-3xl opacity-30"
            style={{ background: "linear-gradient(90deg,#8B5CF6,#60A5FA,#34D399)" }}
          />
        </div>

        {/* Top bar (minimal, luxurious) */}
        <header className="sticky top-0 z-20 border-b border-[var(--card-border)]/60 backdrop-blur-md bg-[color:var(--bg)]/65">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Unlistin
            </Link>
            <nav className="flex items-center gap-2">
              <Link className="btn-ghost px-3 py-1.5 rounded-full text-sm" href="/dashboard">
                Dashboard
              </Link>
              <Link className="btn-ghost px-3 py-1.5 rounded-full text-sm" href="/settings">
                Settings
              </Link>
            </nav>
          </div>
        </header>

        {/* Page container */}
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>

        {/* Footer */}
        <footer className="mt-16 border-t border-[var(--card-border)]/60">
          <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-[color:var(--muted)]">
            © {new Date().getFullYear()} Unlistin · All rights reserved
          </div>
        </footer>
      </body>
    </html>
  );
}
