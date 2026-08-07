-- Run this manually in the Supabase SQL editor.
--
-- check_and_grant_achievements() runs inside the SAME transaction as
-- whatever triggered it (closing a duel, an elo update, a daily_stats
-- insert, a daily_wins insert) — see the triggers in 0039. If anything
-- inside it raises (a bad constraint, a bug, anything), Postgres rolls back
-- the ENTIRE transaction, including the write that triggered it. That's
-- almost certainly what caused duels to silently fail to close / elo to
-- fail to update / daily maps to fail to save between when these triggers
-- first went live and whenever 0040 (adding 'logro_earned' to
-- notifications' type check) actually got run — any grant attempt in that
-- window would have hit the missing constraint value and rolled back
-- whatever gameplay write triggered it.
--
-- This wraps the whole body in an exception handler so achievements can
-- never again block a real write, no matter what goes wrong inside it —
-- worst case a logro silently doesn't get granted/notified this one time
-- (it'll catch up next time this profile's stats are checked), instead of
-- silently breaking the duel/daily-map/elo write that triggered it.

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
  select count(distinct day_number) into daily_maps_count
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
exception
  when others then
    raise warning 'check_and_grant_achievements failed for profile %: %', target_profile_id, sqlerrm;
end;
$$;

-- Diagnostic only — nothing below writes anything. Duels that should have
-- auto-closed (2+ results, matching close_stale_duels()'s own definition
-- of "actually finished" from 0030) but never got closed_at set — the
-- signature of a write that got rolled back by the bug above. If this
-- returns rows, tell me and I'll write a migration to close them properly
-- (computing the correct winner_id the same way the client's
-- computeWinnerId() would have).
select d.id, d.challenger_id, d.opponent_id, d.is_multiplayer, d.matchmaking, d.created_at,
  (select count(*) from duel_results dr where dr.duel_id = d.id) as result_count
from duels d
where d.closed_at is null
  and (select count(*) from duel_results dr where dr.duel_id = d.id) >= 2
order by d.created_at desc;
