-- Run after 0013_daily_stats_public.sql, in the Supabase SQL editor.
--
-- "Mapa del día" now offers two modes: tranqui (untimed, doesn't rank) and
-- competitivo (timed like a duel — 8s per location, taps submit instantly —
-- and ranks against everyone else's competitivo attempt that same day).
-- Both can coexist for the same player/day, so the old one-row-per-day
-- constraint needs the mode folded in.

alter table daily_stats add column timed boolean not null default false;

alter table daily_stats drop constraint daily_stats_profile_id_day_number_key;
alter table daily_stats add constraint daily_stats_profile_id_day_number_timed_key
  unique (profile_id, day_number, timed);
