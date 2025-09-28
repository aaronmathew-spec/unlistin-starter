// app/api/requests/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type Body = {
  category?: string;
  removal_url?: string;
  notes?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const { category = 'other', removal_url = '', notes = '' } = body;

    // If you want to preserve the URL but your table only has `notes`,
    // prefix it into notes. (Adjust later if you add a dedicated URL column.)
    const mergedNotes = removal_url ? `URL: ${removal_url}\n\n${notes}` : notes;

    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from('requests')
      .insert({ category, status: 'new', notes: mergedNotes })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'unexpected error' }, { status: 500 });
  }
}
