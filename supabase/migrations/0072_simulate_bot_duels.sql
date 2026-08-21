-- Run this manually in the Supabase SQL editor.
--
-- Every 3 hours, picks up to 10 random bots (0066), pairs them up (5
-- matches), and plays out a full fake ranked duel between each pair —
-- fabricated per-round results (same distance/score shape as
-- submit_bot_duel_result), then closes the duel normally. Closing it via a
-- plain UPDATE (not a special-cased insert) is deliberate: it's what makes
-- the *existing* apply_duel_elo() trigger (0021) fire and actually move
-- both bots' ELO, so this needs zero ELO logic of its own — just keeps the
-- bot pool's ratings drifting organically instead of sitting frozen at
-- their seeded values forever.

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
  bot1 uuid;
  bot2 uuid;
  new_duel_id uuid;
  round_idx_arr int[];
  pi int;
  loc record;
  results1 jsonb;
  results2 jsonb;
  total1 int;
  total2 int;
  distance numeric;
  points int;
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

    results1 := '[]'::jsonb;
    results2 := '[]'::jsonb;
    total1 := 0;
    total2 := 0;

    for pi in select unnest(round_idx_arr) loop
      select street1, street2, lat, lng into loc from intersections where pool_index = pi;

      distance := round(power(random(), 2) * 3000);
      points := greatest(0, (case when distance <= 50 then 100 else 100 - floor((distance - 50) / 66) end)::int);
      total1 := total1 + points;
      results1 := results1 || jsonb_build_object(
        'street1', loc.street1, 'street2', loc.street2, 'guess', null,
        'actual', jsonb_build_array(loc.lat, loc.lng), 'distance', distance, 'points', points
      );

      distance := round(power(random(), 2) * 3000);
      points := greatest(0, (case when distance <= 50 then 100 else 100 - floor((distance - 50) / 66) end)::int);
      total2 := total2 + points;
      results2 := results2 || jsonb_build_object(
        'street1', loc.street1, 'street2', loc.street2, 'guess', null,
        'actual', jsonb_build_array(loc.lat, loc.lng), 'distance', distance, 'points', points
      );
    end loop;

    insert into duel_results (duel_id, profile_id, results, total_score) values (new_duel_id, bot1, results1, total1);
    insert into duel_results (duel_id, profile_id, results, total_score) values (new_duel_id, bot2, results2, total2);

    if total1 > total2 then
      winner := bot1;
    elsif total2 > total1 then
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
