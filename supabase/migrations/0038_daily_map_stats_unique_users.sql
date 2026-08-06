-- Run this manually in the Supabase SQL editor.
--
-- Adds unique_users to daily_map_stats() — a player who completed both
-- ranked and unranked the same day counts once there, not twice, unlike
-- `total` (which counts attempts, so that same player contributes 2 there).
--
-- Also caps results at "today" in Buenos Aires. Before this session's
-- dayNumberForDate() fix (App.jsx), a device with its clock/timezone ahead
-- of Argentina could submit a daily_stats row dated "tomorrow" — this
-- doesn't touch that stored data, it just excludes any day_number later
-- than the real current day in Buenos Aires from what the admin panel
-- shows, so a stray bad row can't surface as a bogus "current" tile.

create or replace function daily_map_stats()
returns table(day_number int, total bigint, ranked bigint, unranked bigint, unique_users bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  today_ar int;
begin
  if not is_admin_user() then
    raise exception 'not authorized';
  end if;

  today_ar := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - date '2024-01-01');

  return query
    select
      ds.day_number,
      count(*) as total,
      count(*) filter (where ds.timed) as ranked,
      count(*) filter (where not ds.timed) as unranked,
      count(distinct ds.profile_id) as unique_users
    from daily_stats ds
    where ds.day_number <= today_ar
    group by ds.day_number
    order by ds.day_number desc;
end;
$$;
