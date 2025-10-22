// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "Unlistin", template: "%s · Unlistin" },
  description: "Unlistin — requests, coverage, evidence",
  applicationName: "Unlistin",
  alternates: { canonical: SITE.url },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: "Unlistin",
    title: "Unlistin",
    description: "Unlistin — requests, coverage, evidence",
  },
  twitter: {
    card: "summary_large_image",
    title: "Unlistin",
    description: "Unlistin — requests, coverage, evidence",
  },
  robots: {
    index: true,
    follow: true,
  },
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
