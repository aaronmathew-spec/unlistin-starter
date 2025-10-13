import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

export type Controller = {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  channel_types: string[];
  contact_urls: string[];
  privacy_url: string | null;
  dsar_url: string | null;
  auth_type: string | null;
  status: string;
  metadata: Record<string, any>;
};

export async function upsertController(input: Partial<Controller> & { name: string }) {
  // Upsert by name (case-insensitive)
  const { data: existing } = await db
    .from("controllers")
    .select("*")
    .ilike("name", input.name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await db
      .from("controllers")
      .update({
        domain: input.domain ?? existing.domain,
        country: input.country ?? existing.country,
        channel_types: input.channel_types ?? existing.channel_types,
        contact_urls: input.contact_urls ?? existing.contact_urls,
        privacy_url: input.privacy_url ?? existing.privacy_url,
        dsar_url: input.dsar_url ?? existing.dsar_url,
        auth_type: input.auth_type ?? existing.auth_type,
        status: input.status ?? existing.status,
        metadata: input.metadata ?? existing.metadata,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Controller;
  } else {
    const { data, error } = await db
      .from("controllers")
      .insert({
        name: input.name,
        domain: input.domain ?? null,
        country: input.country ?? null,
        channel_types: input.channel_types ?? [],
        contact_urls: input.contact_urls ?? [],
        privacy_url: input.privacy_url ?? null,
        dsar_url: input.dsar_url ?? null,
        auth_type: input.auth_type ?? null,
        status: input.status ?? "active",
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Controller;
  }
}

export async function findControllerByNameOrDomain(q: string) {
  const query = q.toLowerCase();
  const { data: byName } = await db
    .from("controllers")
    .select("*")
    .ilike("name", query)
    .limit(1)
    .maybeSingle();

  if (byName) return byName as Controller;

  const { data: byDomain } = await db
    .from("controllers")
    .select("*")
    .ilike("domain", query)
    .limit(1)
    .maybeSingle();

  return (byDomain as Controller) || null;
}

export async function listControllers(limit = 200) {
  const { data, error } = await db
    .from("controllers")
    .select("*")
    .order("name", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as Controller[];
}
