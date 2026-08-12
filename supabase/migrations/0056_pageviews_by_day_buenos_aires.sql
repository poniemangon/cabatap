-- Run this manually in the Supabase SQL editor.
--
-- pageviews_by_day() (0032) bucketed by UTC calendar day — inconsistent
-- with the rest of the admin panel, which is Argentina-anchored throughout
-- (Mapas del día, daily wins, etc.). Switched to Buenos Aires calendar day.
-- pageviews_by_hour() needs no change: an hour boundary in UTC is also an
-- hour boundary in Argentina (fixed UTC-3, no DST — a whole-hour offset),
-- so the same instants work for both; only the admin panel's client-side
-- label needs adjusting, not the query.

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
      (p.created_at at time zone 'America/Argentina/Buenos_Aires')::date as day_start,
      count(*) as pageviews,
      count(distinct p.session_id) as unique_sessions
    from analytics_pageviews p
    where p.created_at >= since
    group by day_start
    order by day_start;
end;
$$;
