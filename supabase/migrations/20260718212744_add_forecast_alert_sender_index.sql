create index forecast_reviews_alert_sent_by_operator_id_idx
  on public.forecast_reviews (alert_sent_by_operator_id)
  where alert_sent_by_operator_id is not null;
