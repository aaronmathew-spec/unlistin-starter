// app/actions/page.tsx
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSessionUser } from "@/lib/auth";
import { notFound } from "next/navigation";

// Force dynamic so the list is always fresh
export const dynamic = "force-dynamic";
export const metadata = { title: "Action Queue" };

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

type Action = {
  id: string | number;
  created_at: string;
  updated_at: string | null;
  broker: string;
  category: string | null;
  status: string;
  redacted_identity: {
    namePreview?: string;
    emailPreview?: string;
    cityPreview?: string;
  } | null;
  evidence: { url: string; note?: string }[] | null;
  draft_subject?: string | null;
  draft_body?: string | null;
  reply_channel?: "email" | "portal" | "phone" | null;
  reply_email_preview?: string | null;
  proof_hash?: string | null;
  proof_sig?: string | null;
};

export default async function ActionsPage() {
  const user = await getSessionUser();
  if (!user) return notFound();

  const db = supa();
  const { data } = await db
    .from("actions")
    .select(
      [
        "id",
        "created_at",
        "updated_at",
        "broker",
        "category",
        "status",
        "redacted_identity",
        "evidence",
        "draft_subject",
        "draft_body",
        "reply_channel",
        "reply_email_preview",
        "proof_hash",
        "proof_sig",
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const actions: Action[] = Array.isArray(data) ? (data as any) : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Action Queue</h1>
        <RefreshButton />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Track removal actions, and verify cryptographic proof without storing raw PII.
      </p>

      <div className="mt-6 space-y-4">
        {actions.map((a) => (
          <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <div className="font-semibold">{a.broker}</div>
                <div className="text-muted-foreground">{a.category ?? "—"}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Created {new Date(a.created_at).toLocaleString()}
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="text-sm">
                <div className="font-semibold">Identity</div>
                <div className="mt-1 rounded-md border bg-background p-3">
                  <div>Name: {a.redacted_identity?.namePreview || "—"}</div>
                  <div>Email: {a.redacted_identity?.emailPreview || "—"}</div>
                  <div>City: {a.redacted_identity?.cityPreview || "—"}</div>
                </div>
              </div>

              <div className="text-sm">
                <div className="font-semibold">Draft</div>
                <div className="mt-1 rounded-md border bg-background p-3">
                  <div className="font-medium">{a.draft_subject || "—"}</div>
                  <div className="mt-1 line-clamp-4 text-xs whitespace-pre-wrap">
                    {a.draft_body || "—"}
                  </div>
                </div>
              </div>

              <div className="text-sm">
                <div className="font-semibold">Proof</div>
                <div className="mt-1 rounded-md border bg-background p-3">
                  <div className="text-xs break-all">hash: {a.proof_hash || "—"}</div>
                  <div className="text-xs break-all">sig: {a.proof_sig || "—"}</div>
                  {a.id && (
                    <a
                      href={`/api/ledger/verify?id=${encodeURIComponent(String(a.id))}`}
                      target="_blank"
                      className="mt-2 inline-block text-xs underline"
                    >
                      Verify publicly
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="text-sm">
                <span className="rounded-full border px-2 py-0.5">
                  {a.status}
                </span>
              </div>
              <div className="ml-auto text-xs text-muted-foreground">
                Updated {new Date(a.updated_at ?? a.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        {actions.length === 0 && (
          <div className="text-sm text-muted-foreground">No actions yet.</div>
        )}
      </div>
    </div>
  );
}

/** Tiny client-side refresh button */
function RefreshButton() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return (
    <button
      onClick={() => (typeof window !== "undefined" ? window.location.reload() : undefined)}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
    >
      Refresh
    </button>
  );
}
