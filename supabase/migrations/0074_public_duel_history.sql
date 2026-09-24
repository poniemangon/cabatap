-- Run this manually in the Supabase SQL editor.
--
-- Bug: viewing another player's public profile (PublicProfilePage.jsx) shows
-- "0 jugadas" for their duel stats regardless of how much they've actually
-- played. getDuelStats(profileId)/listMyDuels(profileId) query `duels` and
-- `duel_results` for the VIEWED profile's id, but both tables' SELECT
-- policies only allow rows where the REQUESTING session itself is a
-- participant (or it's multiplayer) — so a third-party viewer's session
-- filters everything out, no matter whose id was requested.
--
-- Fix: add an extra permissive SELECT policy on each table for duels that
-- have already closed (finished) — same idea DuelResultPage.jsx already
-- assumes (it's a public, shareable results link). Postgres OR's multiple
-- permissive policies together, so this only ADDS visibility, it doesn't
-- take anything away from the existing participant/admin/multiplayer rules.
-- Scoped to closed_at is not null (not "everything") so an in-progress
-- private 1v1's pending state isn't exposed to strangers.
--
-- No recursion risk: this duel_results policy queries `duels` directly (not
-- through duel_results_count()/duel_results_has_profile()), and the new
-- duels policy doesn't reference duel_results at all — same non-cyclical
-- shape as every other duels SELECT policy already in place.

create policy "closed duels are viewable by everyone"
  on duels for select
  using (closed_at is not null);

create policy "results of closed duels are viewable by everyone"
  on duel_results for select
  using (
    exists (
      select 1 from duels d
      where d.id = duel_results.duel_id
        and d.closed_at is not null
    )
  );
