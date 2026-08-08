-- Run this manually in the Supabase SQL editor.
--
-- Lets a signed-out guest's daily map completion land in daily_stats too
-- (previously guest results only ever lived in sessionStorage, invisible
-- to the admin panel) — profile_id null identifies it as a guest row, and
-- results stays null since there's no player to ever look the round replay
-- back up for; only the score is worth keeping for anonymous plays.

alter table daily_stats alter column profile_id drop not null;
alter table daily_stats alter column results drop not null;

alter table daily_stats add constraint daily_stats_guest_no_results
  check (profile_id is not null or results is null);

-- profile_id is null on every guest row, and Postgres never treats two
-- NULLs as equal for a unique constraint, so the existing
-- (profile_id, day_number, timed) constraint already allows unlimited
-- guest rows per day without any change.

create policy "guests can save an anonymous daily attempt"
  on daily_stats for insert
  with check (profile_id is null and results is null);
