-- "Cerrar duelo" on a private 1v1 (never matchmaking) that nobody else has
-- responded to now deletes the duel outright instead of declaring the
-- closer the winner by forfeit — see handleCloseSoloDuel in App.jsx.
-- Matchmaking duels are deliberately excluded: once queued for a random
-- rival there's no early-close option at all, only waiting (or the
-- separate cancel-while-unclaimed path from 0015, which only applies
-- before anyone — including the challenger — has played their side).
create policy "closer can delete a private duel nobody else responded to"
  on duels for delete
  using (
    not matchmaking
    and closed_at is null
    and (
      exists (select 1 from profiles p where p.clerk_user_id = requesting_user_id() and p.id = duels.challenger_id)
      or exists (select 1 from profiles p where p.clerk_user_id = requesting_user_id() and p.id = duels.opponent_id)
    )
    and (select count(*) from duel_results dr where dr.duel_id = duels.id) <= 1
  );
