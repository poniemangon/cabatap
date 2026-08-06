-- Run this manually in the Supabase SQL editor.
--
-- Adds unique_users to daily_map_stats() — a player who completed both
-- ranked and unranked the same day counts once, not twice, unlike `total`
-- (which counts attempts, so that same player contributes 2 there).

create or replace function daily_map_stats()
returns table(day_number int, total bigint, ranked bigint, unranked bigint, unique_users bigint)
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
      ds.day_number,
      count(*) as total,
      count(*) filter (where ds.timed) as ranked,
      count(*) filter (where not ds.timed) as unranked,
      count(distinct ds.profile_id) as unique_users
    from daily_stats ds
    group by ds.day_number
    order by ds.day_number desc;
end;
$$;
