// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";
import { ToastProvider } from "@/components/providers/ToastProvider";

export const metadata: Metadata = {
  title: { default: "Unlistin", template: "%s · Unlistin" },
  description: "Unlistin — verifiable privacy ops with tamper-evident proof.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Top mini-header (brand only) */}
        <header className="site-header">
          <a className="brand" href="/">Unlistin</a>
          <nav className="nav-minimal">
            <a href="/(app)/dashboard" className="nav-link">Dashboard</a>
            <a href="/(app)/settings" className="nav-link">Settings</a>
          </nav>
        </header>

        <main className="site-main">{children}</main>

        <footer className="site-footer">
          <div className="footer-col">
            <div className="brand">Unlistin</div>
            <div className="muted">&copy; {new Date().getFullYear()} Unlistin, Inc.</div>
          </div>
          <div className="footer-col">
            <a href="/help" className="muted">Help</a>
            <a href="/policy/privacy" className="muted">Privacy</a>
            <a href="/policy/terms" className="muted">Terms</a>
          </div>
        </footer>

        {/* Global toasts (client component) */}
        <ToastProvider />
      </body>
    </html>
  );
}
