alter table public.forecast_reviews
  add column alert_status text not null default 'NOT_SENT'
    check (alert_status in ('NOT_SENT', 'SENDING', 'SENT', 'FAILED')),
  add column alert_id uuid,
  add column alert_log jsonb,
  add column alert_sent_at timestamptz,
  add column alert_sent_by_operator_id bigint
    references public.operator_profiles (id) on delete restrict,
  add constraint forecast_reviews_alert_attempt_complete
    check (alert_status = 'NOT_SENT' or (alert_id is not null and alert_log is not null)),
  add constraint forecast_reviews_sent_alert_complete
    check (
      alert_status <> 'SENT'
      or (alert_sent_at is not null and alert_sent_by_operator_id is not null)
    );

create unique index forecast_reviews_alert_id_key
  on public.forecast_reviews (alert_id)
  where alert_id is not null;

comment on column public.forecast_reviews.alert_status is
  'Brevo delivery state kept separate from the PHIVOLCS review status.';

comment on column public.forecast_reviews.alert_log is
  'Private server-only recipient, message, provider response, and failure snapshot.';
