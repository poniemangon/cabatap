-- Run this manually in the Supabase SQL editor.
--
-- Groups were joined by the raw groups.id (a real Supabase uuid) — anyone
-- with an invite link could see that internal id. invite_id is a short
-- random public-facing code instead, same pattern as duels.invite_code
-- (0001). The default is a VOLATILE expression (random()/clock_timestamp()),
-- so this single ADD COLUMN rewrites the table and generates a distinct
-- random invite_id for every existing group too, not just future ones.

alter table groups add column invite_id text unique not null
  default substr(md5(random()::text || clock_timestamp()::text), 1, 8);
