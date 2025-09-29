-- Migration for {{slice}}
begin;
create table if not exists public.{{slice}} (
  id bigserial primary key,
  name text not null,
  created_at timestamptz not null default now()
);
commit;
