-- Run this manually in the Supabase SQL editor.
--
-- submit_bot_duel_result() (0067) generated each round's distance
-- independently and uniformly, giving the bot's final total no particular
-- shape. Replaced with a bell curve: total is drawn from a normal
-- distribution (Box-Muller transform, since plpgsql has no built-in normal
-- random) centered on 360 with stddev 70, then clamped to [50, 463]. Because
-- 360 sits only ~100 points below the 463 ceiling but ~310 above the 50
-- floor, the same spread makes the two tails naturally asymmetric: grazing
-- 460 happens occasionally (~1.4 sd out), while dropping near 50 is a rare
-- outlier (~4.4 sd out) — matching "on average ~360, rarely near 50, barely
-- reaches 460" without needing a lopsided distribution.
--
-- That total is then split across the duel's rounds the same way
-- simulate_bot_duels() (0072) splits its per-bot totals: jittered around the
-- average per round, last round absorbs the remainder so the rounds sum to
-- exactly the drawn total. Each round's points are turned back into a
-- distance via the inverse of the scoring formula (also lifted from 0072),
-- which then feeds the existing haversine guess-offset logic unchanged.

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
  target int;
  running_sum int;
  avg_per_round numeric;
  num_rounds int;
  idx int;
  pi int;
  loc record;
  distance numeric;
  points int;
  bearing numeric;
  angular_dist numeric;
  lat1 numeric;
  lng1 numeric;
  new_lat numeric;
  new_lng numeric;
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

  num_rounds := array_length(d.round_indices, 1);

  target := round(360 + 70 * sqrt(-2 * ln(greatest(random(), 1e-9))) * cos(2 * pi() * random()));
  target := greatest(50, least(463, target));
  running_sum := 0;
  avg_per_round := target / num_rounds::numeric;

  for idx in 1 .. num_rounds loop
    pi := d.round_indices[idx];
    select street1, street2, lat, lng into loc from intersections where pool_index = pi;

    if idx < num_rounds then
      points := greatest(0, least(100, round(avg_per_round + (random() - 0.5) * 40)::int));
      running_sum := running_sum + points;
    else
      points := greatest(0, least(100, target - running_sum));
    end if;
    total := total + points;

    distance := case when points >= 100 then round(random() * 50) else 50 + (100 - points) * 66 + floor(random() * 66) end;

    bearing := random() * 2 * pi();
    angular_dist := distance / 6371000.0;
    lat1 := radians(loc.lat);
    lng1 := radians(loc.lng);
    new_lat := asin(sin(lat1) * cos(angular_dist) + cos(lat1) * sin(angular_dist) * cos(bearing));
    new_lng := lng1 + atan2(sin(bearing) * sin(angular_dist) * cos(lat1), cos(angular_dist) - sin(lat1) * sin(new_lat));

    results := results || jsonb_build_object(
      'street1', loc.street1,
      'street2', loc.street2,
      'guess', jsonb_build_array(degrees(new_lat), degrees(new_lng)),
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
