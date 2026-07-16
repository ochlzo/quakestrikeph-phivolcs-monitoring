create table public.forecast_reviews (
  id bigint generated always as identity primary key,
  event_id text not null references public."RawEarthquakeEvents" (id) on delete restrict,
  forecast_created_at timestamptz not null,
  status text not null default 'PENDING_REVIEW'
    check (status in ('PENDING_REVIEW', 'DRAFT', 'REVIEWED_NO_ALERT', 'REVIEWED_FOR_ALERT')),
  review_text text not null default '',
  internal_note text not null default '',
  reviewer_email text not null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, forecast_created_at)
);

create index forecast_reviews_status_idx
  on public.forecast_reviews (status, forecast_created_at desc);

alter table public.forecast_reviews enable row level security;

comment on table public.forecast_reviews is
  'Server-managed PHIVOLCS reviews, retained separately for each forecast generation time.';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_email text not null,
  path text not null,
  method text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

comment on table public.audit_logs is
  'Server-only operator activity records. No browser RLS policies are intentionally defined.';
