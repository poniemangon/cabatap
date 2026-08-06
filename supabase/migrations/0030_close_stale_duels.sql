-- Run this manually in the Supabase SQL editor.
--
-- Auto-closes duels nobody ever explicitly closed: closed_at still null,
-- created more than 6 hours ago, and with 2+ duel_results rows (i.e.
-- actually finished — computeWinnerId() in duelApi.js requires at least 2
-- results to name a winner, same rule applied here). Winner is whoever has
-- the strictly-highest total_score; a tie for first leaves winner_id null,
-- mirroring computeWinnerId()'s own logic exactly.
--
-- Deliberately scoped to ONLY this case — duels with 0-1 results (an
-- unclaimed private invite, a matchmaking entry nobody's matched yet, a
-- forfeited private duel) are left untouched. "Closing" a duel with no
-- meaningful data would just be a hollow closed_at + null winner_id, and
-- the app already has its own, different, more deliberate handling for
-- those (0027_duel_close_delete.sql's delete-on-close for private ones,
-- and no expiry at all for matchmaking ones by design). Ask if you also
-- want those cleaned up — this migration only does the "close" part you
-- asked for.
create or replace function close_stale_duels()
returns void
language sql
security definer
set search_path = public
as $$
  with stale as (
    select id
    from duels
    where closed_at is null
      and created_at < now() - interval '6 hours'
      and duel_results_count(id) >= 2
  ),
  scored as (
    select
      dr.duel_id,
      dr.profile_id,
      rank() over (partition by dr.duel_id order by dr.total_score desc) as rnk,
      count(*) over (partition by dr.duel_id, dr.total_score) as tie_count
    from duel_results dr
    join stale s on s.id = dr.duel_id
  ),
  winners as (
    select duel_id, case when tie_count = 1 then profile_id else null end as winner_id
    from scored
    where rnk = 1
  )
  update duels d
  set closed_at = now(), winner_id = w.winner_id
  from winners w
  where d.id = w.duel_id;
$$;

-- Requires the pg_cron extension — already enabled if you ran
-- 0026_daily_wins.sql. If not, enable it first via the Supabase dashboard:
-- Database -> Extensions -> pg_cron.
create extension if not exists pg_cron;

-- Every 6 hours, on the hour. Calling cron.schedule() again with the same
-- job name ("close-stale-duels") updates the existing schedule, so
-- re-running this statement is safe.
select cron.schedule(
  'close-stale-duels',
  '0 */6 * * *',
  $$select close_stale_duels()$$
);
