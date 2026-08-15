-- Run this manually in the Supabase SQL editor.
--
-- apply_duel_elo() (0021) already computes each side's elo before/after a
-- ranked duel closes, it just never kept it anywhere — profiles.elo only
-- ever holds the current value. Persisting both per player on duel_results
-- means a banned cheater's opponent's rating change from that specific
-- match can be identified and given back later, without guessing.

alter table duel_results add column previous_elo int;
alter table duel_results add column new_elo int;

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

    update profiles set elo = new_challenger_elo where id = new.challenger_id;
    update profiles set elo = new_opponent_elo where id = new.opponent_id;

    -- No-op if the corresponding side never submitted a result (forfeit) —
    -- there's no duel_results row to attach the snapshot to in that case.
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
