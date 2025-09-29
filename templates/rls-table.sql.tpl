-- RLS-enabled table for {{slice}}
begin;

-- Base table: owner-scoped rows with audit timestamps
create table if not exists public.{{slice}} (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tr_{{slice}}_updated_at'
  ) then
    create trigger tr_{{slice}}_updated_at
      before update on public.{{slice}}
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Enable RLS
alter table public.{{slice}} enable row level security;

-- Policies: owner read/write
drop policy if exists "{{slice}} select own" on public.{{slice}};
create policy "{{slice}} select own"
on public.{{slice}}
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "{{slice}} insert own" on public.{{slice}};
create policy "{{slice}} insert own"
on public.{{slice}}
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "{{slice}} update own" on public.{{slice}};
create policy "{{slice}} update own"
on public.{{slice}}
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "{{slice}} delete own" on public.{{slice}};
create policy "{{slice}} delete own"
on public.{{slice}}
for delete
to authenticated
using (user_id = auth.uid());

-- Helpful indexes
create index if not exists idx_{{slice}}_user_id_id_desc on public.{{slice}} (user_id, id desc);

commit;
