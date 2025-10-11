// Minimal seed script (Node ESM) — no ts-node needed
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env.');
    process.exit(1);
  }

  const supa = createClient(url, anon);

  const { data, error } = await supa
    .from('actions')
    .insert({
      broker: 'JustDial',
      category: 'directory',
      status: 'prepared',
      redacted_identity: { namePreview: 'A•', emailPreview: 'e•@•', cityPreview: 'C•' },
      evidence: [{ url: 'https://www.justdial.com/foo', note: 'allowlisted' }],
      draft_subject: 'Data removal request',
      draft_body: 'Please remove/correct this listing.',
      fields: { action: 'remove_or_correct' },
      reply_channel: 'email',
      reply_email_preview: 'e•@•',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  } else {
    console.log('Inserted action id:', data?.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
