-- Run this manually in the Supabase SQL editor.
--
-- Server-side time-bucketed aggregation for the admin panel's hourly/daily
-- charts — same reasoning as top_pageviews() in 0031_analytics.sql: avoids
-- pulling potentially thousands of raw pageview rows into the browser just
-- to bucket-and-count them client-side. Both admin-gated internally, same
-- as top_pageviews().
--
-- Buckets with zero activity are simply absent from the result (SQL can't
-- invent rows for events that never happened) — the admin panel fills in
-- the gaps with zeros when rendering.

create or replace function pageviews_by_hour(since timestamptz)
returns table(hour_start timestamptz, pageviews bigint, unique_sessions bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_user() then
    raise exception 'not authorized';
  end if;

  return query
    select
      (date_trunc('hour', p.created_at at time zone 'utc') at time zone 'utc') as hour_start,
      count(*) as pageviews,
      count(distinct p.session_id) as unique_sessions
    from analytics_pageviews p
    where p.created_at >= since
    group by hour_start
    order by hour_start;
end;
$$;

create or replace function pageviews_by_day(since timestamptz)
returns table(day_start date, pageviews bigint, unique_sessions bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_user() then
    raise exception 'not authorized';
  end if;

  return query
    select
      (p.created_at at time zone 'utc')::date as day_start,
      count(*) as pageviews,
      count(distinct p.session_id) as unique_sessions
    from analytics_pageviews p
    where p.created_at >= since
    group by day_start
    order by day_start;
end;
$$;
