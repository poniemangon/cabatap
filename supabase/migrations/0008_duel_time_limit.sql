-- Run after 0007_profile_avatar.sql, in the Supabase SQL editor.
--
-- Private 1v1 duels can now be created untimed. Random and multiplayer stay
-- always-timed at the default. NULL means no per-round time limit.
-- Existing rows backfill to 8 (every duel was implicitly timed at 8s before
-- this column existed).

alter table duels add column time_limit_seconds int default 8;
