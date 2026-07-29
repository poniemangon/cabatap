-- Run after 0006_realtime_duels.sql, in the Supabase SQL editor.
--
-- Lets friend cards on the profile page show a real photo instead of a
-- fallback emoji. Populated from Clerk's user.imageUrl when a profile row
-- is first created (see useProfile.js's ensureProfile) — no backfill for
-- existing rows, they just keep the emoji fallback until they resync.

alter table profiles add column avatar_url text;
