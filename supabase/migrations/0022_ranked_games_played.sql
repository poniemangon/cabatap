-- Run this manually in the Supabase SQL editor.
--
-- Everyone defaults to elo=1000, so before anyone's actually played a
-- ranked duel the ELO leaderboard was just every profile in the database
-- tied at 1000/Gold — useless as a ranking. ranked_games_played tracks how
-- many ranked (1v1 matchmaking) duels a profile has closed, so the
-- leaderboard query can filter down to players who've actually played at
-- least one.
--
-- Bumped by the same apply_duel_elo() trigger that already updates elo, on
-- the exact same condition — no separate trigger needed.

alter table profiles add column ranked_games_played int not null default 0;

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

    update profiles
      set elo = greatest(0, round(challenger_elo + k * (score_challenger - expected_challenger))),
          ranked_games_played = ranked_games_played + 1
      where id = new.challenger_id;
    update profiles
      set elo = greatest(0, round(opponent_elo + k * (score_opponent - expected_opponent))),
          ranked_games_played = ranked_games_played + 1
      where id = new.opponent_id;
  end if;

  return new;
end;
$$;
