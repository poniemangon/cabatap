-- Run after 0005_fix_rls_recursion_and_matchmaking.sql, in the Supabase SQL editor.
--
-- 0004 enabled Realtime for `notifications` but never for `duels` or
-- `duel_results` — so the matchmaking "buscando rival" screen, the 1v1
-- "esperando a tu rival" screen, and the multiplayer leaderboard all still
-- needed a manual "Actualizar" click. This adds both tables to the
-- publication so every duel view updates live instead.

alter publication supabase_realtime add table duels;
alter publication supabase_realtime add table duel_results;
