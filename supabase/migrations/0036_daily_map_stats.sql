-- Run this manually in the Supabase SQL editor.
--
-- Admin-only RPC backing the "Mapas del día" tab: one row per day_number
-- with total daily_stats attempts plus the ranked (timed=true, competitivo)
-- / unranked (timed=false, tranqui) breakdown.

create or replace function daily_map_stats()
returns table(day_number int, total bigint, ranked bigint, unranked bigint)
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
      count(*) filter (where not ds.timed) as unranked
    from daily_stats ds
    group by ds.day_number
    order by ds.day_number desc;
end;
$$;
