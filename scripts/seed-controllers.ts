// scripts/seed-controllers.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);

const tier1 = [
  {
    name: "Truecaller",
    category: "caller_id",
    tier: 1,
    channels: { email: "privacy@truecaller.com", formUrl: "https://www.truecaller.com/unlisting" },
    sla_days: 7,
    identity_requirements: "email_verify",
    escalation_path: ["grievance_officer","dpo","dpb"],
  },
  {
    name: "JustDial",
    category: "directory",
    tier: 1,
    channels: { email: "privacy@justdial.com", formUrl: "https://www.justdial.com/Delete-My-Number" },
    sla_days: 30,
    identity_requirements: "phone_verify",
    escalation_path: ["grievance_officer","dpb"],
  },
  {
    name: "Naukri.com",
    category: "employment",
    tier: 1,
    channels: { email: "grievance@naukri.com" },
    sla_days: 30,
    identity_requirements: "email_verify",
    escalation_path: ["grievance_officer","dpb"],
  },
];

async function main() {
  for (const c of tier1) {
    const { error } = await supabase.from("controllers").upsert(c, { onConflict: "name" });
    if (error) {
      console.error("Upsert error:", c.name, error.message);
      process.exitCode = 1;
    }
  }
  console.log("Seeded Tier-1 controllers.");
}

main();
