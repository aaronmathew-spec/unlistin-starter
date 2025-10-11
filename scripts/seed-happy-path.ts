/* Minimal seed script (node) — optional.
   Usage: ts-node scripts/seed-happy-path.ts  (or compile to JS)
*/
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supa = createClient(url, anon);

  const { data, error } = await supa
    .from("actions")
    .insert({
      broker: "JustDial",
      category: "directory",
      status: "prepared",
      redacted_identity: { namePreview: "A•", emailPreview: "e•@•", cityPreview: "C•" },
      evidence: [{ url: "https://www.justdial.com/foo", note: "allowlisted" }],
      draft_subject: "Data removal request",
      draft_body: "Please remove/correct this listing.",
      fields: { action: "remove_or_correct" },
      reply_channel: "email",
      reply_email_preview: "e•@•",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Seed error:", error.message);
  } else {
    console.log("Inserted action:", data?.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
