-- Run this manually in the Supabase SQL editor.
--
-- Marks a duel_results row's elo change as already given back (admin panel
-- "Devolver ELO" button), so it can't be reverted twice by accident — the
-- button hides once this is true.

alter table duel_results add column elo_reverted boolean not null default false;
