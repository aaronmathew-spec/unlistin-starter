import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";
import { ToastProvider } from "@/components/providers/ToastProvider";

export const metadata: Metadata = {
  title: { default: "Unlistin", template: "%s · Unlistin" },
  description: "Unlistin — requests, coverage, evidence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Global toasts (client component) */}
        <ToastProvider />
      </body>
    </html>
  );
}
