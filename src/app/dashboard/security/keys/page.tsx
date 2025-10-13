import { createClient } from "@supabase/supabase-js";
import KeysClient from "./ui/KeysClient";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

export default async function KeysPage() {
  const { data } = await db
    .from("api_keys")
    .select("id, name, prefix, scopes, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">API Keys</h1>
      <p className="text-sm text-neutral-600 mb-4">Create and revoke Personal Access Tokens.</p>
      {/* Client to create/revoke */}
      <KeysClient initialKeys={data ?? []} />
    </div>
  );
}
