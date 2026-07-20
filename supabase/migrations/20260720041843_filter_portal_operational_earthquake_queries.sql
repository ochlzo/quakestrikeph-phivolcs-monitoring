create or replace function public.get_portal_forecast_page(
  query_text text default null,
  review_statuses text[] default null,
  magnitude_ranges jsonb default null,
  depth_from double precision default null,
  depth_to double precision default null,
  date_from date default null,
  date_to date default null,
  aftershock_24h_likelihoods text[] default null,
  m5_plus_likelihoods text[] default null,
  minimum_estimated_strongest_aftershock double precision default null,
  result_limit integer default 50,
  result_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as materialized (
    select
      prediction.event_id,
      event."Date-Time" as event_date_time,
      event."Latitude" as latitude,
      event."Longitude" as longitude,
      event."Depth" as depth,
      event."Magnitude" as magnitude,
      event."Location" as location,
      event.event_time,
      prediction.created_at,
      prediction.aftershock_24h,
      prediction.m5_plus_aftershock,
      prediction.within_10km,
      prediction.between_10_25km,
      prediction.between_25_50km,
      prediction.beyond_50km,
      prediction.est_max_aftershock,
      prediction.aftershock_24h_likelihood_level,
      prediction.m5_plus_likelihood_level,
      prediction.aftershock_msg,
      prediction.m5_plus_msg,
      prediction.distance_msg,
      prediction.max_magnitude_msg,
      coalesce(review.status, 'PENDING_REVIEW') as review_status,
      coalesce(review.alert_status, 'NOT_SENT') as alert_status
    from public."SeisPredictions_v1" as prediction
    join public."RawEarthquakeEvents" as event on event.id = prediction.event_id
    left join public.forecast_reviews as review
      on review.event_id = prediction.event_id
      and review.forecast_created_at = prediction.created_at
    where event.source_status in ('CURRENT', 'HISTORICAL')
      and (
        nullif(trim(query_text), '') is null
        or position(lower(trim(query_text)) in lower(concat_ws(' ', event.id, event."Location"))) > 0
      )
      and (review_statuses is null or cardinality(review_statuses) = 0
        or coalesce(review.status, 'PENDING_REVIEW') = any(review_statuses))
      and (magnitude_ranges is null or exists (
        select 1
        from jsonb_array_elements(magnitude_ranges) as magnitude_range
        where event."Magnitude" >= (magnitude_range->>'from')::double precision
          and (
            not (magnitude_range ? 'to')
            or case
              when coalesce((magnitude_range->>'upperExclusive')::boolean, false)
                then event."Magnitude" < (magnitude_range->>'to')::double precision
              else event."Magnitude" <= (magnitude_range->>'to')::double precision
            end
          )
      ))
      and (depth_from is null or nullif(event."Depth", '--')::double precision >= depth_from)
      and (depth_to is null or nullif(event."Depth", '--')::double precision <= depth_to)
      and (date_from is null or event.event_time >= date_from::timestamp)
      and (date_to is null or event.event_time < (date_to + 1)::timestamp)
      and (aftershock_24h_likelihoods is null or cardinality(aftershock_24h_likelihoods) = 0
        or lower(prediction.aftershock_24h_likelihood_level) = any(aftershock_24h_likelihoods))
      and (m5_plus_likelihoods is null or cardinality(m5_plus_likelihoods) = 0
        or lower(prediction.m5_plus_likelihood_level) = any(m5_plus_likelihoods))
      and (minimum_estimated_strongest_aftershock is null
        or prediction.est_max_aftershock >= minimum_estimated_strongest_aftershock)
  ), page_rows as (
    select *
    from filtered
    order by created_at desc, event_id desc
    limit least(greatest(coalesce(result_limit, 50), 1), 2000)
    offset greatest(coalesce(result_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(page_rows) order by page_rows.created_at desc, page_rows.event_id desc)
      from page_rows
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_portal_event_page(
  query_text text default null,
  magnitude_ranges jsonb default null,
  depth_from double precision default null,
  depth_to double precision default null,
  date_from date default null,
  date_to date default null,
  result_limit integer default 50,
  result_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as materialized (
    select
      event.id,
      event."Date-Time" as date_time,
      event."Latitude" as latitude,
      event."Longitude" as longitude,
      event."Depth" as depth,
      event."Magnitude" as magnitude,
      event."Location" as location,
      event.event_time
    from public."RawEarthquakeEvents" as event
    where event.source_status in ('CURRENT', 'HISTORICAL')
      and (
        nullif(trim(query_text), '') is null
        or position(lower(trim(query_text)) in lower(concat_ws(' ', event.id, event."Location"))) > 0
      )
      and (magnitude_ranges is null or exists (
        select 1
        from jsonb_array_elements(magnitude_ranges) as magnitude_range
        where event."Magnitude" >= (magnitude_range->>'from')::double precision
          and (
            not (magnitude_range ? 'to')
            or case
              when coalesce((magnitude_range->>'upperExclusive')::boolean, false)
                then event."Magnitude" < (magnitude_range->>'to')::double precision
              else event."Magnitude" <= (magnitude_range->>'to')::double precision
            end
          )
      ))
      and (depth_from is null or nullif(event."Depth", '--')::double precision >= depth_from)
      and (depth_to is null or nullif(event."Depth", '--')::double precision <= depth_to)
      and (date_from is null or event.event_time >= date_from::timestamp)
      and (date_to is null or event.event_time < (date_to + 1)::timestamp)
  ), page_rows as (
    select *
    from filtered
    order by event_time desc nulls last, id desc
    limit least(greatest(coalesce(result_limit, 50), 1), 2000)
    offset greatest(coalesce(result_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(page_rows) order by page_rows.event_time desc nulls last, page_rows.id desc)
      from page_rows
    ), '[]'::jsonb)
  );
$$;
