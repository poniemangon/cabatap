-- Run this manually in the Supabase SQL editor. One-time data fixup, not a
-- schema change — safe to run once, don't re-run (it would just no-op the
-- second time since there'd be nothing left before the cutoff to reclassify).
--
-- ELO effectively went live around 14:00 (America/Argentina/Buenos_Aires)
-- today, but a handful of ranked (matchmaking) duels closed before that —
-- test/practice matches from before the feature was really "on". This
-- relabels those as unranked (matchmaking = false, same as a private duel)
-- so they stop counting anywhere: admin panel, profile stats, and duel
-- history all read off that same column. Then resets elo/ranked_games_played
-- to a clean slate and replays apply_duel_elo()'s exact formula over
-- whatever's left tagged matchmaking = true, in closing order (ELO is
-- sequential — can't just subtract the early matches' effect after the
-- fact, the ratings that came after them were computed on top of them).

update duels
set matchmaking = false
where not is_multiplayer
  and matchmaking
  and closed_at is not null
  and closed_at < ((current_date at time zone 'America/Argentina/Buenos_Aires') + interval '14 hours');

update profiles set elo = 1000, ranked_games_played = 0;

do $$
declare
  d record;
  challenger_elo int;
  opponent_elo int;
  expected_challenger numeric;
  expected_opponent numeric;
  score_challenger numeric;
  score_opponent numeric;
  k constant int := 32;
begin
  for d in
    select id, challenger_id, opponent_id, winner_id
    from duels
    where not is_multiplayer
      and matchmaking
      and closed_at is not null
      and opponent_id is not null
    order by closed_at asc
  loop
    select elo into challenger_elo from profiles where id = d.challenger_id;
    select elo into opponent_elo from profiles where id = d.opponent_id;

    expected_challenger := 1.0 / (1 + power(10, (opponent_elo - challenger_elo) / 400.0));
    expected_opponent := 1.0 / (1 + power(10, (challenger_elo - opponent_elo) / 400.0));

    if d.winner_id = d.challenger_id then
      score_challenger := 1;
      score_opponent := 0;
    elsif d.winner_id = d.opponent_id then
      score_challenger := 0;
      score_opponent := 1;
    else
      score_challenger := 0.5;
      score_opponent := 0.5;
    end if;

    update profiles
      set elo = greatest(0, round(challenger_elo + k * (score_challenger - expected_challenger))),
          ranked_games_played = ranked_games_played + 1
      where id = d.challenger_id;
    update profiles
      set elo = greatest(0, round(opponent_elo + k * (score_opponent - expected_opponent))),
          ranked_games_played = ranked_games_played + 1
      where id = d.opponent_id;
  end loop;
end $$;
