// app/admin/page.tsx
import { isAdmin, getSessionUser } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * Admin-only dashboard.
 * - Customers cannot access this page; they'll 404.
 * - Keep this simple: high-level stats & quick links for you.
 * - No PII is shown here; aggregate-only.
 */
export default async function AdminPage() {
  const ok = await isAdmin();
  if (!ok) return notFound();

  const user = await getSessionUser();

  // You can expand these with server-side metrics endpoints later
  const cards = [
    { kpi: "Automation Enabled Users", value: "—", href: "/settings" },
    { kpi: "Prepared Actions (24h)", value: "—", href: "/actions" },
    { kpi: "Auto-Submit Ready", value: "—", href: "/actions" },
    { kpi: "Follow-ups Due (Today)", value: "—", href: "/actions" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <div className="text-xs text-muted-foreground">
          Signed in as {user?.email || user?.id}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Private controls and roll-up metrics. Customers never see this; they only see their essentials.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.kpi}
            href={c.href}
            className="rounded-2xl border bg-card p-4 shadow-sm transition hover:shadow"
          >
            <div className="text-sm text-muted-foreground">{c.kpi}</div>
            <div className="mt-2 text-2xl font-semibold">{c.value}</div>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="text-base font-medium">Automation Controls</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Tune capability thresholds (coming soon).</li>
          <li>Adapter kill-switch & rate caps (coming soon).</li>
          <li>Outcome learning overview (coming soon).</li>
        </ul>
        <div className="mt-4 text-xs text-muted-foreground">
          All automation is server-side, redacted, and allowlist-enforced.
        </div>
      </section>
    </div>
  );
}
