-- Run this manually in the Supabase SQL editor.
--
-- ELO rating, scoped to 1v1 random-matchmaking duels only (not private
-- 1v1s, not multiplayer). Everyone starts at 1000.
--
-- The rating update has to happen server-side: a player closing their own
-- duel is the one whose UPDATE on `duels` fires this, but the *opponent's*
-- profiles row also needs to change, and "users can update their own
-- profile" (0001) only lets a session touch its own row. A SECURITY DEFINER
-- trigger function bypasses that RLS the same way duel_results_count() and
-- is_admin_user() already do elsewhere in this schema — the client never
-- computes or writes elo itself, so it can't be spoofed.

alter table profiles add column elo int not null default 1000;

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
      set elo = greatest(0, round(challenger_elo + k * (score_challenger - expected_challenger)))
      where id = new.challenger_id;
    update profiles
      set elo = greatest(0, round(opponent_elo + k * (score_opponent - expected_opponent)))
      where id = new.opponent_id;
  end if;

  return new;
end;
$$;

drop trigger if exists duel_elo_trigger on duels;
create trigger duel_elo_trigger
  after update on duels
  for each row
  execute function apply_duel_elo();
