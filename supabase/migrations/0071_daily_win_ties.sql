-- Run this manually in the Supabase SQL editor.
--
-- A tie for the top competitivo score used to only award the trophy to
-- whoever completed first (order by total_score desc, completed_at asc
-- limit 1) — everyone else tied at the same score got nothing. Now every
-- profile tied for the top score gets the win. Same fix for group daily
-- wins. Ranking DISPLAY already shows tied scores at the same rank number
-- client-side (RankingBoard.jsx/RankingPreview.jsx) — this is the other
-- half, the actual trophy award.
--
-- Also excludes ghost_mode players from the award entirely, same as
-- is_banned already was — not just from *receiving* the trophy, but from
-- the top_score calculation itself, so a hidden ghost's score can never
-- silently block a real, visible player from winning. Ghost mode is
-- otherwise invisible everywhere (0066); it staying invisible for wins too
-- keeps that consistent.

alter table daily_wins drop constraint if exists daily_wins_day_number_key;
alter table daily_wins add constraint daily_wins_day_number_profile_id_key unique (day_number, profile_id);

alter table daily_group_wins drop constraint if exists daily_group_wins_group_id_day_number_key;
alter table daily_group_wins add constraint daily_group_wins_group_id_day_number_profile_id_key
  unique (group_id, day_number, profile_id);

create or replace function award_daily_win()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_day int;
  top_score int;
begin
  target_day := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 1) - date '2024-01-01';

  select max(ds.total_score) into top_score
  from daily_stats ds
  join profiles p on p.id = ds.profile_id
  where ds.day_number = target_day
    and ds.timed
    and not p.is_banned
    and not p.ghost_mode;

  if top_score is null then
    return;
  end if;

  insert into daily_wins (profile_id, day_number, daily_stat_id)
  select ds.profile_id, target_day, ds.id
  from daily_stats ds
  join profiles p on p.id = ds.profile_id
  where ds.day_number = target_day
    and ds.timed
    and not p.is_banned
    and not p.ghost_mode
    and ds.total_score = top_score
  on conflict (day_number, profile_id) do nothing;
end;
$$;

create or replace function award_daily_group_wins()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_day int;
  g record;
  member_count int;
  top_score int;
begin
  target_day := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 1) - date '2024-01-01';

  for g in select id from groups loop
    select count(*) into member_count from user_groups where group_id = g.id;
    if member_count < 2 then
      continue;
    end if;

    select max(ds.total_score) into top_score
    from daily_stats ds
    join user_groups ug on ug.user_id = ds.profile_id and ug.group_id = g.id
    join profiles p on p.id = ds.profile_id
    where ds.day_number = target_day
      and not ds.timed
      and not p.is_banned
      and not p.ghost_mode;

    if top_score is null then
      continue;
    end if;

    insert into daily_group_wins (group_id, profile_id, day_number, daily_stat_id)
    select g.id, ds.profile_id, target_day, ds.id
    from daily_stats ds
    join user_groups ug on ug.user_id = ds.profile_id and ug.group_id = g.id
    join profiles p on p.id = ds.profile_id
    where ds.day_number = target_day
      and not ds.timed
      and not p.is_banned
      and not p.ghost_mode
      and ds.total_score = top_score
    on conflict (group_id, day_number, profile_id) do nothing;
  end loop;
end;
$$;
