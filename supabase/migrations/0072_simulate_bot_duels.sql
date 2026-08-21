-- Run this manually in the Supabase SQL editor.
--
-- Every 3 hours, picks up to 10 random bots (0066), pairs them up (5
-- matches), and plays out a full fake ranked duel between each pair —
-- fabricated per-round results (same shape as submit_bot_duel_result), then
-- closes the duel normally. Closing it via a plain UPDATE (not baked into
-- the insert) is deliberate: it's what makes the *existing* apply_duel_elo()
-- trigger (0021) fire and actually move both bots' ELO, so this needs zero
-- ELO logic of its own — just keeps the bot pool's ratings drifting
-- organically instead of sitting frozen at their seeded values forever.
--
-- Each bot's total_score (out of 5 rounds) is generated directly, not
-- summed up from independently-random rounds, so the target distribution is
-- exact: min 50, max 463, median 340. total = 50 + 413 * random()^0.51 —
-- the exponent is solved so that random()=0.5 lands exactly on 340
-- ((340-50)/413 = 0.5^0.51). That total is then split across 5 rounds
-- (jittered around the average, last round absorbs the remainder) purely
-- for a plausible-looking per-round breakdown/map pins — the sum, not the
-- split, is what's actually calibrated.

create or replace function simulate_bot_duels()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bot_ids uuid[];
  pool_indices int[];
  n int;
  i int;
  j int;
  bot1 uuid;
  bot2 uuid;
  new_duel_id uuid;
  round_idx_arr int[];
  pi int;
  loc record;
  results1 jsonb;
  results2 jsonb;
  target1 int;
  target2 int;
  actual1 int;
  actual2 int;
  running_sum int;
  avg_per_round numeric;
  pts int;
  distance numeric;
  winner uuid;
begin
  select array_agg(id) into bot_ids from (select id from profiles where is_bot order by random() limit 10) s;
  n := coalesce(array_length(bot_ids, 1), 0);
  if n < 2 then
    return;
  end if;

  select array_agg(pool_index) into pool_indices from intersections;
  if coalesce(array_length(pool_indices, 1), 0) < 5 then
    return;
  end if;

  i := 1;
  while i + 1 <= n loop
    bot1 := bot_ids[i];
    bot2 := bot_ids[i + 1];
    i := i + 2;

    select array_agg(x) into round_idx_arr
    from (select unnest(pool_indices) as x order by random() limit 5) s;

    if coalesce(array_length(round_idx_arr, 1), 0) < 5 then
      continue;
    end if;

    insert into duels (challenger_id, opponent_id, round_indices, is_multiplayer, matchmaking, time_limit_seconds)
    values (bot1, bot2, round_idx_arr, false, true, 8)
    returning id into new_duel_id;

    target1 := 50 + round(413 * power(random(), 0.51));
    target2 := 50 + round(413 * power(random(), 0.51));

    results1 := '[]'::jsonb;
    results2 := '[]'::jsonb;
    running_sum := 0;
    avg_per_round := target1 / 5.0;

    for j in 1 .. 5 loop
      pi := round_idx_arr[j];
      select street1, street2, lat, lng into loc from intersections where pool_index = pi;

      if j < 5 then
        pts := greatest(0, least(100, round(avg_per_round + (random() - 0.5) * 40)::int));
        running_sum := running_sum + pts;
      else
        pts := greatest(0, least(100, target1 - running_sum));
      end if;

      distance := case when pts >= 100 then round(random() * 50) else 50 + (100 - pts) * 66 + floor(random() * 66) end;
      results1 := results1 || jsonb_build_object(
        'street1', loc.street1, 'street2', loc.street2, 'guess', null,
        'actual', jsonb_build_array(loc.lat, loc.lng), 'distance', distance, 'points', pts
      );
    end loop;

    running_sum := 0;
    avg_per_round := target2 / 5.0;

    for j in 1 .. 5 loop
      pi := round_idx_arr[j];
      select street1, street2, lat, lng into loc from intersections where pool_index = pi;

      if j < 5 then
        pts := greatest(0, least(100, round(avg_per_round + (random() - 0.5) * 40)::int));
        running_sum := running_sum + pts;
      else
        pts := greatest(0, least(100, target2 - running_sum));
      end if;

      distance := case when pts >= 100 then round(random() * 50) else 50 + (100 - pts) * 66 + floor(random() * 66) end;
      results2 := results2 || jsonb_build_object(
        'street1', loc.street1, 'street2', loc.street2, 'guess', null,
        'actual', jsonb_build_array(loc.lat, loc.lng), 'distance', distance, 'points', pts
      );
    end loop;

    insert into duel_results (duel_id, profile_id, results, total_score)
    values (new_duel_id, bot1, results1, (select coalesce(sum((r->>'points')::int), 0) from jsonb_array_elements(results1) r));
    insert into duel_results (duel_id, profile_id, results, total_score)
    values (new_duel_id, bot2, results2, (select coalesce(sum((r->>'points')::int), 0) from jsonb_array_elements(results2) r));

    select duel_results.total_score into actual1 from duel_results where duel_id = new_duel_id and profile_id = bot1;
    select duel_results.total_score into actual2 from duel_results where duel_id = new_duel_id and profile_id = bot2;

    if actual1 > actual2 then
      winner := bot1;
    elsif actual2 > actual1 then
      winner := bot2;
    else
      winner := null;
    end if;

    -- Closing via UPDATE (not baked into the insert above) so the existing
    -- apply_duel_elo() trigger fires and handles ELO for both sides itself.
    update duels set closed_at = now(), winner_id = winner where id = new_duel_id;
  end loop;
end;
$$;

select cron.schedule(
  'simulate-bot-duels',
  '0 */3 * * *',
  $$select simulate_bot_duels()$$
);
