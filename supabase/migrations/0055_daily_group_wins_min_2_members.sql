-- Run this manually in the Supabase SQL editor.
--
-- No daily map trophy for a solo group — "winning" against nobody isn't a
-- competition. Skips any group with fewer than 2 current members entirely.

create or replace function award_daily_group_wins()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_day int;
  g record;
  winner record;
  member_count int;
begin
  target_day := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 1) - date '2024-01-01';

  for g in select id from groups loop
    select count(*) into member_count from user_groups where group_id = g.id;
    if member_count < 2 then
      continue;
    end if;

    winner := null;

    select ds.profile_id, ds.id as daily_stat_id
    into winner
    from daily_stats ds
    join user_groups ug on ug.user_id = ds.profile_id and ug.group_id = g.id
    where ds.day_number = target_day
      and not ds.timed
    order by ds.total_score desc, ds.completed_at asc
    limit 1;

    if winner.daily_stat_id is not null then
      insert into daily_group_wins (group_id, profile_id, day_number, daily_stat_id)
      values (g.id, winner.profile_id, target_day, winner.daily_stat_id)
      on conflict (group_id, day_number) do nothing;
    end if;
  end loop;
end;
$$;
