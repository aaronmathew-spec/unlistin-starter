// app/api/lead/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type LeadBody = {
  name?: string;
  email?: string;
  city_state?: string;
  org_id?: string | null;
  source?: string;
  meta?: Record<string, unknown>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  // --- Parse and sanitize body
  let body: LeadBody = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // ignore – we'll validate below
  }

  const name = (body.name ?? '').toString().trim();
  const email = (body.email ?? '').toString().trim();
  const city_state = (body.city_state ?? '').toString().trim();
  const org_id = body.org_id ?? null;
  const source = (body.source ?? 'site').toString().trim().slice(0, 40) || 'site';
  const meta = (body.meta ?? {}) as Record<string, unknown>;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  // --- Insert person
  const { data: person, error: pErr } = await supabase
    .from('people')
    .insert([
      {
        full_name: name,
        email: email || null,
        city_state: city_state || null,
        org_id, // may be null (unassigned)
        // capture where this came from
        // if you have a "source" or "meta" column, map them here
        // source,
        // meta,
      },
    ])
    .select('id, org_id')
    .single();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  // --- Fire-and-forget confirmation email (optional)
  (async () => {
    try {
      if (email && process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: email,
            subject: 'Welcome to UnlistIN',
            html: `
              <div style="font-family:ui-sans-serif,system-ui">
                <h2>Thanks for signing up${name ? `, ${name}` : ''}!</h2>
                <p>We’ve received your request. We’ll scan public sources and follow up shortly.</p>
                <p style="margin-top:12px">– UnlistIN</p>
              </div>
            `,
          }),
        });
      }
    } catch {
      // swallow email errors; don’t block the request
    }
  })();

  return NextResponse.json(
    {
      ok: true,
      person_id: person!.id,
      org_id: person!.org_id,
      source,
    },
    { status: 201 },
  );
}
