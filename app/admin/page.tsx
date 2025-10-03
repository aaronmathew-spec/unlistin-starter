import { isAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * Admin-only dashboard (server component).
 * Reads /api/admin/overview (server → server) to populate aggregate metrics.
 */
export default async function AdminPage() {
  const ok = await isAdmin();
  if (!ok) return notFound();

  // Server-side fetch to your admin overview API (no caching — always fresh)
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/admin/overview`, {
    cache: "no-store",
  }).catch(() => null);

  let metrics = {
    prepared24h: 0,          // matches /api/admin/overview current payload
    autoSubmitReady: 0,
    followupsDue: 0,
    automationUsers: 0,      // if you add this later
  };
  let actorEmail: string | null = null;

  if (res && res.ok) {
    try {
      const payload = await res.json();
      // accept either shape
      const m = payload?.metrics ?? {};
      metrics = {
        prepared24h: Number(m.prepared24h ?? m.prepared_24h ?? 0),
        autoSubmitReady: Number(m.autoSubmitReady ?? m.auto_submit_ready ?? 0),
        followupsDue: Number(m.followupsDue ?? m.followups_due_today ?? 0),
        automationUsers: Number(m.automationUsers ?? m.automation_users ?? 0),
      };
      const actorObj = payload?.actor ?? payload?.user ?? null;
      actorEmail = actorObj?.email ?? null;
    } catch {
      // fall back to defaults
    }
  }

  const cards = [
    { kpi: "Automation Enabled Users", value: String(metrics.automationUsers), href: "/settings" },
    { kpi: "Prepared Actions (24h)", value: String(metrics.prepared24h), href: "/actions" },
    { kpi: "Auto-Submit Ready", value: String(metrics.autoSubmitReady), href: "/actions" },
    { kpi: "Follow-ups Due (Today)", value: String(metrics.followupsDue), href: "/actions" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <div className="text-xs text-muted-foreground">
          Signed in as {actorEmail ?? "admin"}
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
          <li>Adapter kill-switch &amp; rate caps (coming soon).</li>
          <li>Outcome learning overview (coming soon).</li>
        </ul>
        <div className="mt-4 text-xs text-muted-foreground">
          All automation is server-side, redacted, and allowlist-enforced.
        </div>
      </section>
    </div>
  );
}
