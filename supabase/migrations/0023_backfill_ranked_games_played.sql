-- Run this manually in the Supabase SQL editor, after 0022_ranked_games_played.sql.
--
-- 0022 added ranked_games_played defaulting to 0 for every existing profile,
-- and apply_duel_elo() only increments it going forward from when that
-- trigger update landed — it never counted ranked duels that had already
-- closed before then. Anyone who played (and had their elo adjusted) prior
-- to running 0022 is stuck showing 0 games played despite a real elo, which
-- hides them from the leaderboard's ranked_games_played > 0 filter. This
-- recomputes the true count once from duel history.

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
