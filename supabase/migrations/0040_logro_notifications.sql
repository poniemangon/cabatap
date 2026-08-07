-- Run this manually in the Supabase SQL editor.
--
-- New notification type: fires when check_and_grant_achievements() (0039)
-- actually grants a logro (not on every check — only the ones newly
-- inserted, via the ON CONFLICT DO NOTHING ... RETURNING trick below).

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('duel_completed', 'friend_request', 'duel_matched', 'logro_earned'));

-- Same metric logic as 0039's version — only the grant insert changed, to
-- capture which rows were actually newly inserted (a conflict-skipped row,
-- i.e. one you already had, returns nothing and so gets no notification).
create or replace function check_and_grant_achievements(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_maps_count int;
  daily_wins_count int;
  duels_won_count int;
  duels_played_count int;
  my_elo int;
  my_ranked_games int;
  my_elo_rank int;
  granted record;
begin
  select count(*) into daily_maps_count
  from daily_stats
  where profile_id = target_profile_id;

  select count(*) into daily_wins_count
  from daily_wins
  where profile_id = target_profile_id;

  select count(*) into duels_won_count
  from duels
  where winner_id = target_profile_id and closed_at is not null;

  select count(distinct dr.duel_id) into duels_played_count
  from duel_results dr
  join duels d on d.id = dr.duel_id
  where dr.profile_id = target_profile_id and d.closed_at is not null;

  select elo, ranked_games_played into my_elo, my_ranked_games
  from profiles
  where id = target_profile_id;

  if my_ranked_games > 0 then
    select count(*) + 1 into my_elo_rank
    from profiles p2
    where p2.ranked_games_played > 0 and p2.elo > my_elo;
  else
    my_elo_rank := null;
  end if;

  for granted in
    with ins as (
      insert into logros_jugadores (profile_id, logro_id)
      select target_profile_id, l.id
      from logros l
      where l.is_active
        and (
          (l.metric_type = 'daily_maps_completed' and daily_maps_count >= l.threshold)
          or (l.metric_type = 'daily_wins' and daily_wins_count >= l.threshold)
          or (l.metric_type = 'duels_won' and duels_won_count >= l.threshold)
          or (l.metric_type = 'duels_played' and duels_played_count >= l.threshold)
          or (l.metric_type = 'elo_top_rank' and my_elo_rank is not null and my_elo_rank <= l.threshold)
        )
      on conflict (profile_id, logro_id) do nothing
      returning logro_id
    )
    select ins.logro_id, l.title, l.text, l.image_url
    from ins
    join logros l on l.id = ins.logro_id
  loop
    insert into notifications (profile_id, type, data)
    values (
      target_profile_id,
      'logro_earned',
      jsonb_build_object('logro_id', granted.logro_id, 'title', granted.title, 'text', granted.text, 'image_url', granted.image_url)
    );
  end loop;
end;
$$;

-- One-off backfill: run `select backfill_achievements();` yourself once in
-- the SQL editor to retroactively grant (and notify) every existing user
-- for logros they already qualify for as of right now. Safe to re-run —
-- check_and_grant_achievements() is idempotent per profile.
create or replace function backfill_achievements()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  for p in select id from profiles loop
    perform check_and_grant_achievements(p.id);
  end loop;
end;
$$;
