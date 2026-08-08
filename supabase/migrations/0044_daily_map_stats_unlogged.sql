-- Run this manually in the Supabase SQL editor.
--
-- Adds unlogged to daily_map_stats() — guest completions (profile_id null,
-- see 0043) counted toward `total` and `unranked` before, with no way to
-- tell them apart from a signed-in tranqui play. Now ranked/unranked only
-- count registered players (profile_id not null); unlogged is its own
-- bucket, mutually exclusive from both, so ranked + unranked + unlogged =
-- total.

drop function if exists daily_map_stats();

create or replace function daily_map_stats()
returns table(day_number int, total bigint, ranked bigint, unranked bigint, unlogged bigint, unique_users bigint)
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
  day_unlogged bigint := 0;
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
      unlogged := day_unlogged;
      unique_users := coalesce(array_length(seen_profiles, 1), 0);
      return next;

      day_total := 0;
      day_ranked := 0;
      day_unranked := 0;
      day_unlogged := 0;
      seen_profiles := '{}';
    end if;
    cur_day := rec.d;

    day_total := day_total + 1;
    if rec.p is null then
      day_unlogged := day_unlogged + 1;
    elsif rec.t then
      day_ranked := day_ranked + 1;
    else
      day_unranked := day_unranked + 1;
    end if;

    if rec.p is not null and not (rec.p = any(seen_profiles)) then
      seen_profiles := seen_profiles || rec.p;
    end if;
  end loop;

  if cur_day is not null then
    day_number := cur_day;
    total := day_total;
    ranked := day_ranked;
    unranked := day_unranked;
    unlogged := day_unlogged;
    unique_users := array_length(seen_profiles, 1);
    return next;
  end if;
end;
$$;
