-- Run this manually in the Supabase SQL editor.
--
-- Ghost mode: an admin-only flag. A ghost player is invisible to everyone
-- else on every ranking (daily map, ELO, group rankings) — they still see
-- themselves there, just nobody else does — and their ranked duels
-- ("Duelo rankeado") are matched against a fake bot profile instead of a
-- real waiting player, so a real player's own ranked queue is never
-- affected by playing against a ghost. All the filtering logic lives
-- client-side (see dailyApi.js/duelApi.js/groupsApi.js), same pattern this
-- app already uses for every other ranking query.
--
-- is_bot marks the fake opponents themselves — excluded from every ranking
-- unconditionally (nobody should ever see a bot on a leaderboard).

alter table profiles add column ghost_mode boolean not null default false;
alter table profiles add column is_bot boolean not null default false;

-- Pre-seeded fake opponents — word+word+number, lowercase, English. A
-- fixed pool (not generated per-match) so they don't pile up in the
-- profiles table over time; ranked duels against a ghost just pick one at
-- random each time (see duelApi.js's getRandomBotProfile).
insert into profiles (clerk_user_id, username, is_bot, elo, ranked_games_played)
values
  ('bot-' || gen_random_uuid(), 'silentfox42', true, 980, 12),
  ('bot-' || gen_random_uuid(), 'brightwolf17', true, 1050, 8),
  ('bot-' || gen_random_uuid(), 'quietstorm63', true, 1120, 20),
  ('bot-' || gen_random_uuid(), 'happytiger29', true, 940, 5),
  ('bot-' || gen_random_uuid(), 'coldriver91', true, 1005, 15),
  ('bot-' || gen_random_uuid(), 'darkeagle38', true, 1080, 11),
  ('bot-' || gen_random_uuid(), 'brightlion56', true, 960, 9),
  ('bot-' || gen_random_uuid(), 'silentbear74', true, 1030, 18),
  ('bot-' || gen_random_uuid(), 'happyhawk22', true, 995, 6),
  ('bot-' || gen_random_uuid(), 'coldwolf85', true, 1110, 24),
  ('bot-' || gen_random_uuid(), 'quiettiger11', true, 970, 4),
  ('bot-' || gen_random_uuid(), 'darkfalcon67', true, 1015, 13),
  ('bot-' || gen_random_uuid(), 'brightriver34', true, 1045, 10),
  ('bot-' || gen_random_uuid(), 'silentstorm99', true, 925, 7),
  ('bot-' || gen_random_uuid(), 'happyeagle48', true, 1090, 21),
  ('bot-' || gen_random_uuid(), 'coldfox16', true, 1000, 14),
  ('bot-' || gen_random_uuid(), 'darklion73', true, 955, 8),
  ('bot-' || gen_random_uuid(), 'brighthawk28', true, 1065, 16),
  ('bot-' || gen_random_uuid(), 'quietbear52', true, 985, 5),
  ('bot-' || gen_random_uuid(), 'silenttiger39', true, 1035, 19),
  ('bot-' || gen_random_uuid(), 'happywolf64', true, 1010, 12),
  ('bot-' || gen_random_uuid(), 'coldeagle87', true, 945, 6),
  ('bot-' || gen_random_uuid(), 'darkriver21', true, 1075, 22),
  ('bot-' || gen_random_uuid(), 'brightfox58', true, 990, 9),
  ('bot-' || gen_random_uuid(), 'quietfalcon33', true, 1055, 17),
  ('bot-' || gen_random_uuid(), 'silentlion76', true, 930, 4),
  ('bot-' || gen_random_uuid(), 'happystorm41', true, 1100, 23),
  ('bot-' || gen_random_uuid(), 'coldhawk19', true, 965, 7),
  ('bot-' || gen_random_uuid(), 'darkbear82', true, 1020, 15),
  ('bot-' || gen_random_uuid(), 'brighttiger47', true, 1040, 11)
on conflict (username) do nothing;

-- Fabricates a bot's duel_results row for a just-created ghost-mode ranked
-- duel: one round per pool_index in duels.round_indices, a plausible random
-- distance/score per round (skewed toward closer guesses, same as a real
-- player would mostly manage), no guess coordinate (the map just shows the
-- actual-location pin for those rounds, same as a timed-out round). Once
-- this exists, the ghost player's own submission brings duel_results to 2
-- and the existing auto-close/ELO logic takes over unchanged.
--
-- SECURITY DEFINER because duel_results' insert policy requires the caller
-- to *be* the profile being inserted for (0001) — impossible for a bot,
-- which has no real session. Authorizes itself instead: caller must be the
-- duel's own challenger.
create or replace function submit_bot_duel_result(target_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  bot_id uuid;
  results jsonb := '[]'::jsonb;
  total int := 0;
  idx int;
  pi int;
  loc record;
  distance numeric;
  points int;
begin
  select * into d from duels where id = target_duel_id;
  if d.id is null then
    raise exception 'duel not found';
  end if;

  if not exists (
    select 1 from profiles p
    where p.id = d.challenger_id and p.clerk_user_id = requesting_user_id()
  ) then
    raise exception 'not authorized';
  end if;

  select id into bot_id from profiles where id = d.opponent_id and is_bot;
  if bot_id is null then
    raise exception 'opponent is not a bot';
  end if;

  for idx in 1 .. array_length(d.round_indices, 1) loop
    pi := d.round_indices[idx];
    select street1, street2, lat, lng into loc from intersections where pool_index = pi;

    distance := round(power(random(), 2) * 3000);
    points := greatest(0, (case when distance <= 50 then 100 else 100 - floor((distance - 50) / 66) end)::int);
    total := total + points;

    results := results || jsonb_build_object(
      'street1', loc.street1,
      'street2', loc.street2,
      'guess', null,
      'actual', jsonb_build_array(loc.lat, loc.lng),
      'distance', distance,
      'points', points
    );
  end loop;

  insert into duel_results (duel_id, profile_id, results, total_score)
  values (target_duel_id, bot_id, results, total)
  on conflict (duel_id, profile_id) do nothing;
end;
$$;
