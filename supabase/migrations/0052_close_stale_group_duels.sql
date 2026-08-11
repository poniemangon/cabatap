-- Run this manually in the Supabase SQL editor.
--
-- Group duels otherwise only close once EVERY current group member has
-- played (close_group_duel_if_complete, 0048/0050) — with no time limit,
-- one absent/inactive member leaves it open forever. Mirrors
-- close_stale_duels() (0030) for group duels specifically, on the same
-- 6-hour cadence, using the same duel_results_count() helper (0005) to
-- avoid the RLS self-reference recursion that direct-counting from
-- duel_results already bit this app twice (0005, 0049):
--   - 2+ results: closes it, winner = strictly-highest total_score (a tie
--     for first leaves winner_id null), same as close_stale_duels().
--   - 0-1 results: deletes the duel outright — nothing meaningful to
--     declare a winner over, same reasoning close_stale_duels() itself
--     cites for leaving those untouched rather than closing them hollow.

create or replace function close_stale_group_duels()
returns void
language sql
security definer
set search_path = public
as $$
  with stale as (
    select id
    from duels
    where group_duel is not null
      and closed_at is null
      and created_at < now() - interval '6 hours'
  ),
  to_close as (
    select id from stale where duel_results_count(id) >= 2
  ),
  to_delete as (
    select id from stale where duel_results_count(id) <= 1
  ),
  scored as (
    select
      dr.duel_id,
      dr.profile_id,
      rank() over (partition by dr.duel_id order by dr.total_score desc) as rnk,
      count(*) over (partition by dr.duel_id, dr.total_score) as tie_count
    from duel_results dr
    join to_close tc on tc.id = dr.duel_id
  ),
  winners as (
    select duel_id, case when tie_count = 1 then profile_id else null end as winner_id
    from scored
    where rnk = 1
  ),
  closed as (
    update duels d
    set closed_at = now(), winner_id = w.winner_id
    from winners w
    where d.id = w.duel_id
    returning d.id
  )
  delete from duels where id in (select id from to_delete);
$$;

-- Requires pg_cron — already enabled if you ran 0026/0030.
create extension if not exists pg_cron;

select cron.schedule(
  'close-stale-group-duels',
  '0 */6 * * *',
  $$select close_stale_group_duels()$$
);
