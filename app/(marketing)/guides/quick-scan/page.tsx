// app/(marketing)/guides/quick-scan/page.tsx
"use client";

import Link from "next/link";

export default function QuickScanGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Quick Scan — How it works</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Quick Scan is designed for privacy: it never persists PII, only returns
        redacted previews and allowlisted evidence links.
      </p>

      <ol className="mt-6 space-y-4 text-sm">
        <li className="rounded-xl border bg-card p-4">
          <strong>1) Input is transient.</strong> Your name/email/city are processed
          server-side and never stored. Redacted previews only are returned to the UI.
        </li>
        <li className="rounded-xl border bg-card p-4">
          <strong>2) Allowlist enforced.</strong> We show links only from approved domains.
          This prevents unsafe sources from ever reaching your browser.
        </li>
        <li className="rounded-xl border bg-card p-4">
          <strong>3) “Why this matched”.</strong> We explain matches using redacted evidence
          (no raw PII). You can <em>Verify locally</em> with a private search string.
        </li>
        <li className="rounded-xl border bg-card p-4">
          <strong>4) Dark-web hints.</strong> Consumer previews show non-sensitive tips from
          allowlisted surfaces. Full enrichment happens during Deep Scan with consent.
        </li>
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/scan/quick" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          Run Quick Scan
        </Link>
        <Link href="/scan/deep" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          Try Deep Scan (first free)
        </Link>
      </div>
    </div>
  );
}
