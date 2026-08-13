-- Run this manually in the Supabase SQL editor.
--
-- Adds a moderation flag to profiles. Banned players keep their account and
-- history (nothing is deleted/hidden at the row level) — they're just
-- excluded from daily-map win awards and every ranking table, and blocked
-- client-side from starting a new competitivo/ranked run (see App.jsx).

alter table profiles add column is_banned boolean not null default false;

-- award_daily_win(): same as 0026, plus excluding banned players from ever
-- winning the daily trophy.
create or replace function award_daily_win()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_day int;
  winner record;
begin
  target_day := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 1) - date '2024-01-01';

  select ds.profile_id, ds.id as daily_stat_id
  into winner
  from daily_stats ds
  join profiles p on p.id = ds.profile_id
  where ds.day_number = target_day
    and ds.timed
    and not p.is_banned
  order by ds.total_score desc, ds.completed_at asc
  limit 1;

  if winner.daily_stat_id is not null then
    insert into daily_wins (profile_id, day_number, daily_stat_id)
    values (winner.profile_id, target_day, winner.daily_stat_id)
    on conflict (day_number) do nothing;
  end if;
end;
$$;

-- award_daily_group_wins(): same as 0055, plus excluding banned members from
-- ever winning their group's daily trophy.
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
    join profiles p on p.id = ds.profile_id
    where ds.day_number = target_day
      and not ds.timed
      and not p.is_banned
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
