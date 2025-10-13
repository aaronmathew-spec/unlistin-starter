import { createClient } from "@supabase/supabase-js";
import WebhooksClient from "./ui/WebhooksClient";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

export default async function WebhooksPage() {
  const { data } = await db
    .from("webhooks")
    .select("id, url, events, disabled, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Webhooks</h1>
      <p className="text-sm text-neutral-600 mb-4">Receive signed events (HMAC SHA256) from UnlistIN.</p>
      <WebhooksClient initialWebhooks={data ?? []} />
    </div>
  );
}
