-- Run this manually in the Supabase SQL editor.
--
-- 0059's rewrite of apply_duel_elo() (to snapshot previous_elo/new_elo)
-- accidentally dropped the `ranked_games_played = ranked_games_played + 1`
-- bump that 0022 had added to the same UPDATE statements. Elo itself kept
-- updating correctly, but ranked_games_played stayed frozen — which hides a
-- player's ELO badge/rank everywhere the UI gates on
-- `ranked_games_played > 0` (EloBadge, ranking page, profile), even though
-- they just played a ranked duel. Restoring the increment here.

create or replace function apply_duel_elo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k constant int := 32;
  challenger_elo int;
  opponent_elo int;
  expected_challenger numeric;
  expected_opponent numeric;
  score_challenger numeric;
  score_opponent numeric;
  new_challenger_elo int;
  new_opponent_elo int;
begin
  if new.closed_at is not null
     and old.closed_at is null
     and not new.is_multiplayer
     and new.matchmaking
     and new.opponent_id is not null then

    select elo into challenger_elo from profiles where id = new.challenger_id;
    select elo into opponent_elo from profiles where id = new.opponent_id;

    expected_challenger := 1.0 / (1 + power(10, (opponent_elo - challenger_elo) / 400.0));
    expected_opponent := 1.0 / (1 + power(10, (challenger_elo - opponent_elo) / 400.0));

    if new.winner_id = new.challenger_id then
      score_challenger := 1;
      score_opponent := 0;
    elsif new.winner_id = new.opponent_id then
      score_challenger := 0;
      score_opponent := 1;
    else
      score_challenger := 0.5;
      score_opponent := 0.5;
    end if;

    new_challenger_elo := greatest(0, round(challenger_elo + k * (score_challenger - expected_challenger)));
    new_opponent_elo := greatest(0, round(opponent_elo + k * (score_opponent - expected_opponent)));

    update profiles
      set elo = new_challenger_elo, ranked_games_played = ranked_games_played + 1
      where id = new.challenger_id;
    update profiles
      set elo = new_opponent_elo, ranked_games_played = ranked_games_played + 1
      where id = new.opponent_id;

    update duel_results
      set previous_elo = challenger_elo, new_elo = new_challenger_elo
      where duel_id = new.id and profile_id = new.challenger_id;
    update duel_results
      set previous_elo = opponent_elo, new_elo = new_opponent_elo
      where duel_id = new.id and profile_id = new.opponent_id;
  end if;

  return new;
end;
$$;

-- Backfill: recompute ranked_games_played from actual duel history (same
-- query as 0023) to fix the drift from however many matches closed while
-- the buggy version above was live.
with ranked_duels as (
  select id, challenger_id, opponent_id
  from duels
  where not is_multiplayer and matchmaking and closed_at is not null
),
counts as (
  select profile_id, count(*) as n
  from (
    select challenger_id as profile_id from ranked_duels
    union all
    select opponent_id as profile_id from ranked_duels where opponent_id is not null
  ) participants
  group by profile_id
)
update profiles p
set ranked_games_played = counts.n
from counts
where counts.profile_id = p.id;
