-- Run this manually in the Supabase SQL editor.
--
-- unique_users: walks every daily_stats row for a given day in order,
-- keeping a running list of profile_ids already seen that day. A row whose
-- profile_id isn't in that list yet adds 1 and gets added to the list; a
-- repeat profile_id (ranked + unranked same day) adds nothing. `total`
-- still counts every row (attempts), so that same player contributes 2
-- there but only 1 to unique_users.
--
-- Also caps results at "today" in Buenos Aires. Before this session's
-- dayNumberForDate() fix (App.jsx), a device with its clock/timezone ahead
-- of Argentina could submit a daily_stats row dated "tomorrow" — this
-- doesn't touch that stored data, it just excludes any day_number later
-- than the real current day in Buenos Aires from what the admin panel
-- shows, so a stray bad row can't surface as a bogus "current" tile.

-- Postgres won't let create-or-replace change an existing function's
-- return-table shape (adding unique_users counts as changing it), so the
-- old signature has to be dropped first.
drop function if exists daily_map_stats();

create or replace function daily_map_stats()
returns table(day_number int, total bigint, ranked bigint, unranked bigint, unique_users bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  today_ar int;
  rec record;
  cur_day int := null;
  day_total bigint := 0;
  day_ranked bigint := 0;
  day_unranked bigint := 0;
  seen_profiles uuid[] := '{}';
begin
  if not is_admin_user() then
    raise exception 'not authorized';
  end if;

  today_ar := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - date '2024-01-01');

  for rec in
    select ds.day_number as d, ds.profile_id as p, ds.timed as t
    from daily_stats ds
    where ds.day_number <= today_ar
    order by ds.day_number desc, ds.profile_id
  loop
    if cur_day is not null and rec.d <> cur_day then
      day_number := cur_day;
      total := day_total;
      ranked := day_ranked;
      unranked := day_unranked;
      unique_users := array_length(seen_profiles, 1);
      return next;

      day_total := 0;
      day_ranked := 0;
      day_unranked := 0;
      seen_profiles := '{}';
    end if;
    cur_day := rec.d;

    day_total := day_total + 1;
    if rec.t then
      day_ranked := day_ranked + 1;
    else
      day_unranked := day_unranked + 1;
    end if;

    if not (rec.p = any(seen_profiles)) then
      seen_profiles := seen_profiles || rec.p;
    end if;
  end loop;

  if cur_day is not null then
    day_number := cur_day;
    total := day_total;
    ranked := day_ranked;
    unranked := day_unranked;
    unique_users := array_length(seen_profiles, 1);
    return next;
  end if;
end;
$$;
