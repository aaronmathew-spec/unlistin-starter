// app/(marketing)/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: true }, // policy-driven noindex example
  title: "Privacy Policy",
  description: "How UnlistIN protects data and privacy.",
};

export default function PrivacyPage() {
  return (
    <main className="container">
      <h1>Privacy Policy</h1>
      <p>...</p>
    </main>
  );
}
