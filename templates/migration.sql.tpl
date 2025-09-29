-- Migration for {{slice}}
begin;

-- Example: create a table (customize as needed)
create table if not exists public.{{slice}} (
  id bigserial primary key,
  name text not null,
  created_at timestamptz not null default now()
);

commit;
