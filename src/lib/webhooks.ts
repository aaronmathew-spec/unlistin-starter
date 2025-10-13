import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

function sign(body: string, secret: string) {
  const t = Math.floor(Date.now() / 1000);
  const mac = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return { header: `t=${t},v1=${mac}`, t };
}

export async function emitWebhook(userId: string, event: string, payload: any) {
  // Load active webhooks for user subscribed to event
  const { data: hooks } = await db
    .from("webhooks")
    .select("id, url, secret, events, disabled")
    .eq("user_id", userId)
    .eq("disabled", false);

  if (!hooks || hooks.length === 0) return;

  const body = JSON.stringify({ event, createdAt: new Date().toISOString(), payload });

  for (const h of hooks) {
    if (Array.isArray(h.events) && h.events.length && !h.events.includes(event)) continue;

    const sig = sign(body, h.secret);
    let status = 0;
    let resBody: any = null;

    try {
      const res = await fetch(h.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "unlistin-webhook/1.0",
          "x-unlistin-signature": sig.header,
        },
        body,
      });
      status = res.status;
      try {
        resBody = await res.text();
      } catch {}
    } catch (e: any) {
      status = 599;
      resBody = String(e?.message || e);
    }

    await db.from("webhook_deliveries").insert({
      user_id: userId,
      webhook_id: h.id,
      event,
      status,
      request: { headers: { "x-unlistin-signature": sig.header }, body: JSON.parse(body) },
      response: { body: resBody },
    });
  }
}
