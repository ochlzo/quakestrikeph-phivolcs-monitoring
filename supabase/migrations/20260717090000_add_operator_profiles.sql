create table if not exists public.operator_profiles (
  email text primary key,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operator_profiles enable row level security;

comment on table public.operator_profiles is
  'Server-managed PHIVOLCS operator display profiles keyed by verified Cloudflare Access email.';
