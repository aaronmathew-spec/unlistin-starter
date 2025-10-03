// app/admin/health/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/auth";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export default async function AdminHealthPage() {
  const ok = await isAdmin();
  if (!ok) return notFound();

  const db = supa();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

  // Heartbeats
  const { data: beats } = await db.from("job_heartbeats").select("*");
  const hb: Record<string, string | null> = {};
  (beats || []).forEach((b: any) => (hb[b.job_id] = b.last_run_at));

  // Counts
  const [{ count: outboxQueued }, { count: outboxSent }, { count: sent24 }, { count: resolved24 }, { count: dueFollowups }] =
    await Promise.all([
      db.from("outbox_emails").select("id", { count: "exact", head: true }).eq("status", "queued"),
      db.from("outbox_emails").select("id", { count: "exact", head: true }).eq("status", "sent"),
      db.from("actions").select("id", { count: "exact", head: true }).eq("status", "sent").gte("updated_at", dayAgo),
      db.from("actions").select("id", { count: "exact", head: true }).eq("status", "resolved").gte("updated_at", dayAgo),
      db.from("followups").select("id", { count: "exact", head: true }).eq("scheduled", false),
    ]);

  // Killed adapters
  const { data: ctrls } = await db.from("adapter_controls").select("*").eq("killed", true);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">System Health (Admin)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Silent automation status. No PII. Customers never see this.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card k="Follow-ups Last Run" v={fmt(hb["followups.run"])} />
        <Card k="Auto-Submit Last Run" v={fmt(hb["actions.submit"])} />
        <Card k="Change-Detect Last Run" v={fmt(hb["detect.changes"])} />
        <Card k="Outbox Queued" v={num(outboxQueued)} />
        <Card k="Outbox Sent (total)" v={num(outboxSent)} />
        <Card k="Sent (24h)" v={num(sent24)} />
        <Card k="Resolved (24h)" v={num(resolved24)} />
        <Card k="Follow-ups Due" v={num(dueFollowups)} />
        <Card k="Adapters Killed" v={String((ctrls || []).length)} />
      </div>

      <section className="mt-8 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="text-base font-medium">Notes</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Crons should update last-run timestamps daily (9:00, 10:00, 11:00 as configured).</li>
          <li>Outbox is a queue; a sender can mark items as <code>sent</code> later.</li>
          <li>Use <a className="underline" href="/admin/adapters">Adapters</a> to toggle kill-switches or caps.</li>
        </ul>
      </section>
    </div>
  );
}

function Card({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-sm text-muted-foreground">{k}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{v}</div>
    </div>
  );
}

function fmt(x?: string | null) {
  if (!x) return "—";
  try {
    return new Date(x).toLocaleString();
  } catch {
    return x ?? "—";
  }
}
function num(n?: number | null) {
  return typeof n === "number" ? String(n) : "0";
}
