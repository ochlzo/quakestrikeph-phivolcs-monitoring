create table public."AlertLogs" (
  processing_job_id text primary key
    references public."ProcessingJobs" (job_id),
  event_id text not null
    references public."RawEarthquakeEvents" (id),
  alert_log jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index alert_logs_event_id_idx
  on public."AlertLogs" (event_id);

alter table public."AlertLogs" enable row level security;

revoke all on table public."AlertLogs" from public, anon, authenticated;
