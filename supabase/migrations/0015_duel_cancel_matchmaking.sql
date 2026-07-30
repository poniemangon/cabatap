-- Lets the creator of an unclaimed "Duelo random" entry delete it when they
-- cancel the search, instead of it lingering as a stale matchmaking
-- candidate (previously only mitigated client-side via a staleness cutoff
-- in findOpenRandomDuel, never actually cleaned up).
create policy "challenger can cancel their own unclaimed matchmaking duel"
  on duels for delete
  using (
    matchmaking
    and opponent_id is null
    and closed_at is null
    and exists (
      select 1 from profiles p
      where p.clerk_user_id = requesting_user_id()
        and p.id = duels.challenger_id
    )
  );
