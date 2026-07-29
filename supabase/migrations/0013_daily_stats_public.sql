-- Run after 0012_fix_forfeit_recursion.sql, in the Supabase SQL editor.
--
-- Daily results become shareable links (/mapa-diario/:id), same idea as
-- duels already being viewable by anyone with the code — so a specific
-- day's attempt needs to be readable by everyone, not just its owner.
-- Insert/update stay owner-only (0011), only SELECT changes.

drop policy if exists "users can view their own daily stats" on daily_stats;

create policy "daily stats are viewable by everyone"
  on daily_stats for select
  using (true);
