alter table public.operator_profiles
  add column id bigint generated always as identity;

alter table public.operator_profiles
  alter column display_name set default 'Operator',
  drop constraint operator_profiles_pkey,
  add constraint operator_profiles_pkey primary key (id),
  add constraint operator_profiles_email_key unique (email);

insert into public.operator_profiles (email)
select distinct lower(trim(review.reviewer_email))
from public.forecast_reviews as review
where not exists (
  select 1
  from public.operator_profiles as profile
  where lower(profile.email) = lower(trim(review.reviewer_email))
)
on conflict (email) do nothing;

alter table public.forecast_reviews
  add column operator_id bigint;

update public.forecast_reviews as review
set operator_id = profile.id
from public.operator_profiles as profile
where lower(profile.email) = lower(trim(review.reviewer_email));

alter table public.forecast_reviews
  alter column operator_id set not null,
  add constraint forecast_reviews_operator_id_fkey
    foreign key (operator_id) references public.operator_profiles (id) on delete restrict,
  drop column reviewer_email;

comment on column public.forecast_reviews.operator_id is
  'Operator profile that created or most recently updated this forecast review.';
