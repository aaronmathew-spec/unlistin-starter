// app/api/requests/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

function asInt(v: string | string[]) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) ? n : null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = asInt(params.id);
  if (id === null) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('requests')
    .select('id, created_at, category, status, notes, removal_url')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = asInt(params.id);
  if (id === null) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const supabase = getServerSupabase();
  const payload = await req.json().catch(() => ({} as Record<string, unknown>));

  const allowed: Record<string, unknown> = {};
  for (const k of ['status', 'notes', 'category', 'removal_url'] as const) {
    if (k in payload) allowed[k] = payload[k];
  }
  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('requests')
    .update(allowed)
    .eq('id', id)
    .select('id, status, notes, category, removal_url')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
