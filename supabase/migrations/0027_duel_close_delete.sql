-- "Cerrar duelo" on a private 1v1 (never matchmaking) that nobody else has
-- responded to now deletes the duel outright instead of declaring the
-- closer the winner by forfeit — see handleCloseSoloDuel in App.jsx.
-- Matchmaking duels are deliberately excluded: once queued for a random
-- rival there's no early-close option at all, only waiting (or the
-- separate cancel-while-unclaimed path from 0015, which only applies
-- before anyone — including the challenger — has played their side).
--
-- Uses duel_results_count() (see 0005_fix_rls_recursion_and_matchmaking.sql)
-- instead of a raw `select count(*) from duel_results ...` subquery — that
-- raw form re-triggers duel_results' own RLS policy, which queries duels
-- right back, hitting the exact "infinite recursion detected in policy for
-- relation duels" (42P17) cycle 0005/0012 already fixed elsewhere. The
-- security-definer helper sidesteps duel_results' RLS entirely.
create policy "closer can delete a private duel nobody else responded to"
  on duels for delete
  using (
    not matchmaking
    and closed_at is null
    and (
      exists (select 1 from profiles p where p.clerk_user_id = requesting_user_id() and p.id = duels.challenger_id)
      or exists (select 1 from profiles p where p.clerk_user_id = requesting_user_id() and p.id = duels.opponent_id)
    )
    and duel_results_count(duels.id) <= 1
  );
