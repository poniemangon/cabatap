-- Run this manually in the Supabase SQL editor.
--
-- Before this session's dayNumberForDate() fix, "today" for the daily map
-- was read from the player's DEVICE calendar date, not pinned to Buenos
-- Aires. A device with its clock/timezone reading ahead of Argentina could
-- submit a daily_stats row dated "tomorrow" — which then sorts to the top
-- of admin's Mapas del día tab (order by day_number desc), showing a date
-- that hasn't happened yet in Buenos Aires.
--
-- completed_at is a server-recorded timestamptz, unaffected by any client
-- clock, so it's a reliable source to recompute the correct day_number from
-- for any row whose stored day_number is impossible (later than "today" in
-- Buenos Aires terms even at end-of-day).
--
-- Step 1 — see what's actually wrong. today_ar is computed the same way
-- award_daily_win() (0026_daily_wins.sql) computes "today" in Argentina.
select
  ds.id,
  ds.profile_id,
  ds.day_number as stored_day_number,
  ds.timed,
  ds.completed_at,
  ((ds.completed_at at time zone 'America/Argentina/Buenos_Aires')::date - date '2024-01-01') as correct_day_number,
  ((now() at time zone 'America/Argentina/Buenos_Aires')::date - date '2024-01-01') as today_ar
from daily_stats ds
where ds.day_number > ((now() at time zone 'America/Argentina/Buenos_Aires')::date - date '2024-01-01')
order by ds.day_number desc;

-- Step 2 — fix them. Recomputes day_number from completed_at for any row
-- dated later than "today" in Buenos Aires. Skips (leaves untouched) any
-- row whose corrected day_number would collide with an existing
-- (profile_id, day_number, timed) row — those need a manual look, since two
-- real attempts would be colliding into one slot.
update daily_stats ds
set day_number = ((ds.completed_at at time zone 'America/Argentina/Buenos_Aires')::date - date '2024-01-01')
where ds.day_number > ((now() at time zone 'America/Argentina/Buenos_Aires')::date - date '2024-01-01')
  and not exists (
    select 1 from daily_stats other
    where other.profile_id = ds.profile_id
      and other.timed = ds.timed
      and other.day_number = ((ds.completed_at at time zone 'America/Argentina/Buenos_Aires')::date - date '2024-01-01')
      and other.id <> ds.id
  );
